/**
 * AI 코치 채팅 — 입력 검증과 RAG 응답 해석. 서버·테스트가 함께 쓰는 순수 함수만 둔다.
 * API 형식은 docs/API_SPEC.md 3절(앱 API)과 5절(RAG 서버 API)이 원본이다.
 */

export const QUESTION_MAX_LENGTH = 500;
export const TITLE_MAX_LENGTH = 80;
export const AUTO_TITLE_LENGTH = 40;
/** 한 대화의 모델용 문맥(state) 최대 크기. 넘으면 저장하지 않고 다음 질문을 새 문맥으로 시작한다. */
export const STATE_MAX_CHARS = 64 * 1024;
export const MESSAGES_DEFAULT_LIMIT = 30;
export const MESSAGES_MAX_LIMIT = 50;
export const CONVERSATIONS_LIMIT = 50;

export const CHAT_STATUSES = ["generated", "direct", "clarify", "portfolio_required"] as const;
export type ChatStatus = (typeof CHAT_STATUSES)[number];

export type CoachHealthState = "ready" | "waking" | "unavailable";

/** RAG 응답에서 로그용으로 남기는 필드. turini_messages.meta 에 저장하고 브라우저에는 status 만 준다. */
const META_KEYS = ["route", "is_followup", "retrieval_query", "profile", "degraded", "latency_s"] as const;

export type ParsedRagChat = {
  answer: string;
  status: ChatStatus;
  needsPortfolio: boolean;
  /** null 이면 문맥 없음(새 대화처럼 이어감) */
  state: Record<string, unknown> | null;
  meta: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 질문 문자열 정리. 비었거나 너무 길면 null. */
export function normalizeQuestion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const question = value.trim();
  if (!question || [...question].length > QUESTION_MAX_LENGTH) return null;
  return question;
}

/** 새 대화의 제목 = 첫 질문 앞 40자 (줄바꿈·연속 공백은 한 칸으로). */
export function titleFromQuestion(question: string): string {
  const flat = question.replace(/\s+/gu, " ").trim();
  const chars = [...flat];
  return chars.length > AUTO_TITLE_LENGTH ? `${chars.slice(0, AUTO_TITLE_LENGTH).join("")}…` : flat;
}

/** 사용자가 바꾸는 제목. 1~80자가 아니면 null. */
export function normalizeTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/\s+/gu, " ").trim();
  if (!title || [...title].length > TITLE_MAX_LENGTH) return null;
  return title;
}

/** 대화 id 는 앱이 발급한 UUID 만 받는다. */
export function isConversationId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
}

export function clampMessageLimit(value: unknown): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1) return MESSAGES_DEFAULT_LIMIT;
  return Math.min(parsed, MESSAGES_MAX_LIMIT);
}

/** beforeSeq 쿼리. 없거나 잘못된 값이면 null (가장 최근부터). */
export function parseBeforeSeq(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 1 ? parsed : null;
}

/**
 * RAG POST /chat 응답 해석. answer 가 없으면 null (앱은 502 로 처리).
 * status 가 모르는 값이면 generated 로 본다 — answer 에는 항상 보여줄 문장이 들어 있다는 약속 때문이다.
 */
export function parseRagChat(body: unknown): ParsedRagChat | null {
  if (!isRecord(body)) return null;
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (!answer) return null;
  const status = CHAT_STATUSES.find((item) => item === body.status) ?? "generated";
  const meta: Record<string, unknown> = { status };
  for (const key of META_KEYS) {
    const value = body[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") meta[key] = value;
  }
  let state = isRecord(body.state) ? body.state : null;
  if (state && JSON.stringify(state).length > STATE_MAX_CHARS) {
    state = null;
    meta.state_dropped = true;
  }
  return { answer, status, needsPortfolio: body.needs_portfolio === true, state, meta };
}

/** RAG 호출 결과 → 브라우저에 줄 HTTP 상태와 문장. docs/API_SPEC.md 5절 "앱 → RAG 오류 변환". */
export function coachErrorFor(kind: "not_configured" | "warming" | "timeout" | "bad_request" | "upstream") {
  switch (kind) {
    case "not_configured":
      return { status: 503, error: "AI 코치가 아직 연결되지 않았어요.", retryAfter: null };
    case "warming":
      return { status: 503, error: "코치를 깨우는 중이에요. 잠시 후 다시 시도해 주세요.", retryAfter: 10 };
    case "timeout":
      return { status: 504, error: "코치의 답변이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.", retryAfter: null };
    case "bad_request":
      return { status: 400, error: "질문을 다시 확인해 주세요.", retryAfter: null };
    default:
      return { status: 502, error: "코치의 답변을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", retryAfter: null };
  }
}
