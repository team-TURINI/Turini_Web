import { randomUUID } from "node:crypto";

import { buildPortfolioContext } from "@/app/coach-context";
import { coachErrorFor, isConversationId, normalizeQuestion, parseRagChat, titleFromQuestion } from "@/app/coach-utils";
import { getCurrentUser } from "@/app/server/auth";
import { getConversation, saveTurn } from "@/app/server/coach-store";
import { databaseErrorResponse } from "@/app/server/db";
import { ragChat, ragConfigured } from "@/app/server/rag-client";

export const runtime = "nodejs";
// RAG 응답을 최대 70초 기다린다 (rag-client 의 CHAT_TIMEOUT_MS). 호스팅의 함수 시간 제한이 이보다 짧으면 안 된다.
export const maxDuration = 120;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 10;
const globalRate = globalThis as typeof globalThis & {
  turiniCoachRate?: Map<string, { start: number; count: number }>;
};
const rateStore = globalRate.turiniCoachRate ??= new Map();

function withinRateLimit(userId: string) {
  const now = Date.now();
  const current = rateStore.get(userId);
  if (!current || now - current.start >= RATE_LIMIT_WINDOW_MS) {
    rateStore.set(userId, { start: now, count: 1 });
    return true;
  }
  if (current.count >= RATE_LIMIT_REQUESTS) return false;
  current.count += 1;
  return true;
}

function errorResponse(kind: Parameters<typeof coachErrorFor>[0]) {
  const mapped = coachErrorFor(kind);
  return Response.json(
    { error: mapped.error },
    { status: mapped.status, headers: mapped.retryAfter ? { "Retry-After": String(mapped.retryAfter) } : undefined },
  );
}

/** 질문 → 답변. docs/API_SPEC.md 3-2절 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const question = normalizeQuestion(body?.question);
    if (!question) return Response.json({ error: "질문은 1~500자로 입력해 주세요." }, { status: 400 });

    const requestedId = body?.conversationId;
    if (requestedId !== undefined && requestedId !== null && !isConversationId(requestedId)) {
      return Response.json({ error: "대화를 찾지 못했어요." }, { status: 404 });
    }
    if (!ragConfigured()) return errorResponse("not_configured");
    if (!withinRateLimit(user.id)) {
      return Response.json({ error: "질문이 너무 많아요. 1분 뒤 다시 시도해 주세요." }, { status: 429 });
    }

    const existing = isConversationId(requestedId) ? await getConversation(user.id, requestedId) : null;
    if (isConversationId(requestedId) && !existing) {
      return Response.json({ error: "대화를 찾지 못했어요." }, { status: 404 });
    }

    // 포트폴리오는 브라우저가 보낸 값이 아니라 저장된 값으로, 규칙엔진을 서버에서 다시 돌려 만든다.
    const portfolio = buildPortfolioContext(user.progress, user.portfolio);
    const result = await ragChat({
      question,
      state: existing?.state ?? null,
      ...(portfolio ? { portfolio } : {}),
      user_id: user.id,
    });
    if (!result.ok) return errorResponse(result.kind);

    const parsed = parseRagChat(result.body);
    if (!parsed) {
      console.error("RAG chat returned an unreadable body");
      return errorResponse("upstream");
    }

    const conversationId = existing?.id ?? randomUUID();
    const previousCount = existing?.message_count ?? 0;
    const saved = await saveTurn({
      userId: user.id,
      conversationId,
      newTitle: existing ? null : titleFromQuestion(question),
      previousCount,
      question,
      answer: parsed.answer,
      meta: parsed.meta,
      state: parsed.state,
    });
    if (saved === "conflict") {
      return Response.json({ error: "대화가 다른 곳에서 바뀌었어요. 내역을 새로 불러온 뒤 다시 시도해 주세요." }, { status: 409 });
    }

    return Response.json({
      conversationId,
      answer: parsed.answer,
      status: parsed.status,
      seq: previousCount + 2,
      isNewConversation: !existing,
      needsPortfolio: parsed.needsPortfolio,
    });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
