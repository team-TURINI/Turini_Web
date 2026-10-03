import "server-only";

import type { CoachHealthState } from "../coach-utils";

/**
 * RAG 서버 호출 (docs/API_SPEC.md 5절). 브라우저가 아니라 앱 서버만 호출한다.
 * RAG 서버는 대화를 저장하지 않는다 — 질문·문맥(state)·포트폴리오를 받아 답변과 새 문맥을 돌려준다.
 */

const HEALTH_TIMEOUT_MS = 5_000;
const CHAT_TIMEOUT_MS = 70_000;

export type RagChatRequest = {
  question: string;
  state: Record<string, unknown> | null;
  portfolio?: unknown;
  user_id?: string;
};

export type RagChatResult =
  | { ok: true; body: unknown }
  | { ok: false; kind: "not_configured" | "warming" | "timeout" | "bad_request" | "upstream" };

function ragConfig() {
  const baseUrl = (process.env.RAG_API_URL || "").trim().replace(/\/+$/u, "");
  const apiKey = (process.env.RAG_API_KEY || "").trim();
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
}

export function ragConfigured() {
  return ragConfig() !== null;
}

/** 기동 여부. 내려가 있던 서버는 이 호출로 뜨기 시작한다. */
export async function ragHealth(): Promise<CoachHealthState> {
  const config = ragConfig();
  if (!config) return "unavailable";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.baseUrl}/health`, { signal: controller.signal, cache: "no-store" });
    return response.ok ? "ready" : "waking";
  } catch {
    // 시간 초과·연결 실패는 "뜨는 중"으로 본다. 끝내 안 뜨면 프론트가 90초 뒤 unavailable 로 바꾼다.
    return "waking";
  } finally {
    clearTimeout(timeout);
  }
}

export async function ragChat(payload: RagChatRequest): Promise<RagChatResult> {
  const config = ragConfig();
  if (!config) return { ok: false, kind: "not_configured" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.ok) return { ok: true, body: await response.json().catch(() => null) };
    if (response.status === 503) return { ok: false, kind: "warming" };
    if (response.status === 422) return { ok: false, kind: "bad_request" };
    // 401 은 앱 서버 설정 오류(키 불일치)다. 사용자에게는 일반 오류로 보이고 로그로 구분한다.
    console.error("RAG chat failed", response.status);
    return { ok: false, kind: "upstream" };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("RAG chat error", aborted ? "timeout" : error instanceof Error ? error.name : "unknown");
    return { ok: false, kind: "timeout" };
  } finally {
    clearTimeout(timeout);
  }
}
