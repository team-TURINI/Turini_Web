"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { QUESTION_MAX_LENGTH, type CoachHealthState } from "./coach-utils";

/**
 * 포트폴리오 탭 > AI 코치 탭의 채팅. API 는 docs/API_SPEC.md 3절.
 *  · 지난 대화는 앱 DB 에서 읽으므로 코치(RAG 서버)가 내려가 있어도 보인다.
 *  · 코치가 뜨는 중이면 입력창만 잠그고 5초마다 다시 확인한다 (최대 90초).
 *  · 포트폴리오와 문맥은 서버가 붙인다. 브라우저는 질문과 대화 id 만 보낸다.
 */

type ChatMessage = {
  seq: number;
  role: "user" | "assistant";
  content: string;
  status?: string;
};

type HealthView = "checking" | CoachHealthState;

const HEALTH_RETRY_MS = 5_000;
const HEALTH_GIVE_UP_MS = 90_000;
const PAGE_SIZE = 30;

const SUGGESTIONS = [
  "내 포트폴리오의 위험등급은 무슨 뜻이야?",
  "조정안대로 바꾸면 뭐가 달라져?",
  "ETF와 펀드는 뭐가 달라?",
];

async function readJson(response: Response) {
  return await response.json().catch(() => ({})) as Record<string, unknown>;
}

export default function CoachChat() {
  const [health, setHealth] = useState<HealthView>("checking");
  const [healthAttempt, setHealthAttempt] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // 코치 기동 여부 — 뜨는 중이면 5초마다 다시 묻고, 90초가 지나면 포기한다.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();
    const check = async () => {
      let state: CoachHealthState = "waking";
      try {
        const response = await fetch("/api/coach/health", { cache: "no-store" });
        const body = await readJson(response);
        if (response.ok && (body.state === "ready" || body.state === "waking" || body.state === "unavailable")) state = body.state;
        else if (!response.ok) state = "unavailable";
      } catch {
        state = "waking";
      }
      if (cancelled) return;
      if (state === "waking" && Date.now() - startedAt >= HEALTH_GIVE_UP_MS) state = "unavailable";
      setHealth(state);
      if (state === "waking") timer = window.setTimeout(check, HEALTH_RETRY_MS);
    };
    void check();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [healthAttempt]);

  // 가장 최근 대화를 이어서 보여 준다.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const listResponse = await fetch("/api/coach/conversations", { cache: "no-store" });
        const list = await readJson(listResponse);
        const latest = Array.isArray(list.conversations) ? list.conversations[0] as { conversationId?: unknown } | undefined : undefined;
        if (!listResponse.ok || typeof latest?.conversationId !== "string") return;
        const messagesResponse = await fetch(`/api/coach/conversations/${latest.conversationId}/messages?limit=${PAGE_SIZE}`, { cache: "no-store" });
        const body = await readJson(messagesResponse);
        if (cancelled || !messagesResponse.ok || !Array.isArray(body.messages)) return;
        setConversationId(latest.conversationId);
        setMessages(body.messages as ChatMessage[]);
      } catch {
        // 내역을 못 불러와도 새 질문은 할 수 있다.
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, pendingQuestion]);

  const loadOlder = useCallback(async () => {
    const first = messages[0];
    if (!conversationId || !first || first.seq <= 1) return;
    try {
      const response = await fetch(`/api/coach/conversations/${conversationId}/messages?limit=${PAGE_SIZE}&beforeSeq=${first.seq}`, { cache: "no-store" });
      const body = await readJson(response);
      if (response.ok && Array.isArray(body.messages)) setMessages((current) => [...(body.messages as ChatMessage[]), ...current]);
    } catch {
      setError("이전 대화를 불러오지 못했어요.");
    }
  }, [conversationId, messages]);

  const send = useCallback(async (text: string) => {
    const question = text.trim();
    if (!question || pendingQuestion !== null || health !== "ready") return;
    setError("");
    setDraft("");
    setPendingQuestion(question);
    let targetId = conversationId;
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch("/api/coach/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(targetId ? { question, conversationId: targetId } : { question }),
        });
        const body = await readJson(response);
        if (response.ok && typeof body.answer === "string" && typeof body.conversationId === "string") {
          const seq = typeof body.seq === "number" ? body.seq : 0;
          const started = body.isNewConversation === true;
          setConversationId(body.conversationId);
          setMessages((current) => [
            ...(started ? [] : current),
            { seq: seq - 1, role: "user", content: question },
            { seq, role: "assistant", content: body.answer as string, status: typeof body.status === "string" ? body.status : undefined },
          ]);
          return;
        }
        // 지워졌거나 남의 대화면 새 대화로 한 번만 다시 보낸다.
        if (response.status === 404 && targetId && attempt === 0) {
          targetId = null;
          continue;
        }
        if (response.status === 503) {
          setHealth("checking");
          setHealthAttempt((value) => value + 1);
        }
        setDraft(question);
        setError(typeof body.error === "string" ? body.error : "답변을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
    } catch {
      setDraft(question);
      setError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setPendingQuestion(null);
    }
  }, [conversationId, health, pendingQuestion]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(draft);
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError("");
  };

  const retryHealth = () => {
    setHealth("checking");
    setHealthAttempt((value) => value + 1);
  };

  const busy = pendingQuestion !== null;
  const inputLocked = health !== "ready" || busy;
  const empty = messages.length === 0 && !busy;
  const hasOlder = messages.length > 0 && messages[0].seq > 1;
  const placeholder = health === "ready" ? "투리니 코치에게 물어보세요" : health === "unavailable" ? "지금은 코치와 연결되지 않아요" : "코치를 깨우는 중이에요…";

  return (
    <section className="coach-chat" aria-label="AI 코치와 대화">
      <header className="coach-chat-head">
        <div>
          <p className="eyebrow">TURINI AI COACH</p>
          <h3>코치에게 물어보기</h3>
        </div>
        {messages.length > 0 && <button type="button" className="coach-chat-new" onClick={startNewConversation} disabled={busy}>새 대화</button>}
      </header>

      {(health === "checking" || health === "waking") && <p className="coach-chat-status" role="status">코치를 깨우는 중이에요. 준비되면 바로 질문할 수 있어요.</p>}
      {health === "unavailable" && <p className="coach-chat-status warn" role="status">지금은 코치와 연결되지 않아요. 지난 대화는 볼 수 있어요. <button type="button" onClick={retryHealth}>다시 시도</button></p>}

      <div className="coach-chat-list" ref={listRef} aria-live="polite">
        {hasOlder && <button type="button" className="coach-chat-older" onClick={() => void loadOlder()}>이전 대화 더 보기</button>}
        {historyLoading && <p className="coach-chat-hint">지난 대화를 불러오고 있어요…</p>}
        {!historyLoading && empty && (
          <div className="coach-chat-empty">
            <p>포트폴리오 결과나 금융 개념이 궁금하면 물어보세요.</p>
            <div className="coach-chat-suggestions">
              {SUGGESTIONS.map((item) => <button type="button" key={item} disabled={inputLocked} onClick={() => void send(item)}>{item}</button>)}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.seq} className={`coach-chat-bubble ${message.role}`}>
            <p>{message.content}</p>
            {message.status === "portfolio_required" && <small>위의 ‘포트폴리오 분석’을 먼저 마치면 내 배분을 바탕으로 답해 드려요.</small>}
          </div>
        ))}
        {pendingQuestion !== null && <>
          <div className="coach-chat-bubble user"><p>{pendingQuestion}</p></div>
          <div className="coach-chat-bubble assistant pending" role="status"><p>답변을 쓰고 있어요…</p></div>
        </>}
      </div>

      {error && <p className="coach-chat-error" role="alert">{error}</p>}

      <form className="coach-chat-form" onSubmit={submit}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={QUESTION_MAX_LENGTH}
          placeholder={placeholder}
          disabled={inputLocked}
          aria-label="코치에게 보낼 질문"
        />
        <button type="submit" className="primary-button" disabled={inputLocked || !draft.trim()}>보내기</button>
      </form>
      <p className="coach-chat-disclaimer">금융 학습을 위한 설명이에요. 특정 상품의 매수·매도 권유가 아니에요.</p>
    </section>
  );
}
