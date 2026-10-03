/**
 * AI 코치 채팅 — 포트폴리오 문맥과 입력·응답 처리.
 * 형식의 원본은 docs/rag/portfolio-context.schema.json · docs/API_SPEC.md 3~5절이다.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import { PORTFOLIO_CONTEXT_SCHEMA_VERSION, buildPortfolioContext } from "../app/coach-context.ts";
import {
  AUTO_TITLE_LENGTH,
  MESSAGES_DEFAULT_LIMIT,
  MESSAGES_MAX_LIMIT,
  QUESTION_MAX_LENGTH,
  STATE_MAX_CHARS,
  clampMessageLimit,
  coachErrorFor,
  isConversationId,
  normalizeQuestion,
  normalizeTitle,
  parseBeforeSeq,
  parseRagChat,
  titleFromQuestion,
} from "../app/coach-utils.ts";
import { ASSETS, PORTFOLIO_RULE_VERSION, analyzeAllocation } from "../app/portfolio-rules.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = JSON.parse(read("../docs/rag/portfolio-context.schema.json"));
const example = JSON.parse(read("../docs/rag/portfolio-context.example.json"));

const ALLOCATION = { domestic: 0.55, overseas: 0.1, bond: 0.05, equityFund: 0, cash: 0.3, gold: 0 };
const PROGRESS = { tendency: "안정형", financeLevel: "초급", weakTags: ["분산투자 기본 원리", "위험-수익 관계"] };
const savedPortfolio = (overrides = {}) => ({
  allocation: ALLOCATION,
  amount: 12_000_000,
  goal: "장기 자산 증식",
  horizon: "3~10년",
  inputMode: "actual",
  result: { riskGrade: 3 },
  ruleVersion: PORTFOLIO_RULE_VERSION,
  ...overrides,
});

/** ajv 는 eslint 의 의존성으로 들어와 있다. 없으면 스키마 검증 테스트만 건너뛴다. */
function compileSchema() {
  try {
    const Ajv = createRequire(import.meta.url)("ajv");
    return new Ajv({ allErrors: true }).compile(schema);
  } catch {
    return null;
  }
}

test("문서의 예시는 지금 엔진이 만드는 문맥과 정확히 같다", () => {
  assert.deepEqual(buildPortfolioContext(PROGRESS, savedPortfolio()), example);
});

test("문맥은 스키마를 통과한다 — 성향 4 × 기간 4 × 배분 여러 종", (t) => {
  const validate = compileSchema();
  if (!validate) return t.skip("ajv 미설치");
  const keys = ASSETS.map((asset) => asset.key);
  const allocations = keys.map((only) => Object.fromEntries(keys.map((key) => [key, key === only ? 1 : 0])));
  let seed = 7;
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  while (allocations.length < 120) {
    const units = keys.map(() => (random() < 0.45 ? 0 : Math.floor(random() * 8)));
    const total = units.reduce((sum, unit) => sum + unit, 0);
    if (!total) continue;
    const steps = units.map((unit) => Math.round((unit / total) * 20));
    steps[steps.indexOf(Math.max(...steps))] += 20 - steps.reduce((sum, step) => sum + step, 0);
    if (steps.some((step) => step < 0)) continue;
    allocations.push(Object.fromEntries(keys.map((key, index) => [key, steps[index] / 20])));
  }
  const statuses = new Set();
  for (const tendency of ["진단 전", "안정형", "중립형", "공격형"]) {
    for (const horizon of ["1년 미만", "1~3년", "3~10년", "10년 이상"]) {
      for (const allocation of allocations) {
        const context = buildPortfolioContext({ tendency, financeLevel: "진단 전", weakTags: [] }, savedPortfolio({ allocation, horizon, inputMode: "practice" }));
        assert.ok(context);
        statuses.add(context.computed.recommendation_status);
        assert.ok(validate(context), `${tendency} · ${horizon} · ${JSON.stringify(allocation)} → ${JSON.stringify(validate.errors?.slice(0, 2))}`);
      }
    }
  }
  assert.ok(statuses.has("hold") && statuses.has("recommended") && statuses.has("horizon_capped"));
});

test("computed 는 저장된 결과가 아니라 엔진을 다시 돌린 값이다", () => {
  const tampered = savedPortfolio({ result: { riskGrade: 6, riskVar: 0.1, typeFitLabel: "성향과 잘 맞아요" } });
  const context = buildPortfolioContext(PROGRESS, tampered);
  const fresh = analyzeAllocation(ALLOCATION, "안정형", "3~10년");
  assert.equal(context.computed.risk_grade, fresh.riskGrade);
  assert.equal(context.computed.fit_type_label, fresh.typeFitLabel);
  assert.equal(context.computed.fit_type_ok, false);
  assert.deepEqual(context.computed.cautions, fresh.cautions);
});

test("금액·목적·진단 원점수·자산 계획은 문맥에 들어가지 않는다", () => {
  const context = buildPortfolioContext(
    { ...PROGRESS, xp: 900, rawScore: 33, profileScore: 4 },
    savedPortfolio({ amount: 98_765_432, planner: { currentAssets: 55_555_555 } }),
  );
  const text = JSON.stringify(context);
  for (const leaked of ["98765432", "55555555", "amount", "goal", "planner", "rawScore", "profileScore", "xp"]) {
    assert.ok(!text.includes(leaked), leaked);
  }
  assert.deepEqual(Object.keys(context), ["schema_version", "diagnosis", "portfolio", "computed"]);
  assert.equal(context.schema_version, PORTFOLIO_CONTEXT_SCHEMA_VERSION);
});

test("분석 전·예전 엔진 버전·잘못된 입력이면 문맥을 보내지 않는다", () => {
  assert.equal(buildPortfolioContext(PROGRESS, {}), null);
  assert.equal(buildPortfolioContext(PROGRESS, null), null);
  assert.equal(buildPortfolioContext(PROGRESS, savedPortfolio({ result: null })), null);
  assert.equal(buildPortfolioContext(PROGRESS, savedPortfolio({ ruleVersion: "4.0.1-portfolio-v11" })), null);
  assert.equal(buildPortfolioContext(PROGRESS, savedPortfolio({ horizon: "5년 이상" })), null);
  assert.equal(buildPortfolioContext(PROGRESS, savedPortfolio({ allocation: { ...ALLOCATION, cash: 0.9 } })), null);
});

test("진단 전이면 중립형으로 계산하고 diagnosed 를 false 로 알린다", () => {
  const context = buildPortfolioContext({}, savedPortfolio());
  assert.deepEqual(context.diagnosis, { diagnosed: false, risk_type: "중립형", level_type: null, weak_tags: [] });
  assert.equal(context.computed.fit_type_label, analyzeAllocation(ALLOCATION, "중립형", "3~10년").typeFitLabel);
});

test("조정안이 없으면 near_target 은 null 이고 조정 항목도 비어 있다", () => {
  const hold = buildPortfolioContext({ tendency: "안정형" }, savedPortfolio({ allocation: { domestic: 0.05, overseas: 0.1, bond: 0.45, equityFund: 0.05, cash: 0.3, gold: 0.05 } }));
  assert.equal(hold.computed.recommendation_status, "hold");
  assert.equal(hold.computed.near_target, null);
  assert.deepEqual(hold.computed.rebalancing_actions, []);
  assert.equal(hold.computed.fit_type_ok, true);
  assert.equal(hold.computed.fit_horizon_ok, true);
});

test("연습 입력은 '연습' 으로, 취약 태그는 최근 10개만 보낸다", () => {
  const tags = Array.from({ length: 14 }, (_, index) => `태그${index}`);
  const context = buildPortfolioContext({ tendency: "공격형", weakTags: [...tags, 3, ""] }, savedPortfolio({ inputMode: "practice" }));
  assert.equal(context.portfolio.input_mode, "연습");
  assert.equal(context.diagnosis.weak_tags.length, 10);
  assert.ok(context.diagnosis.weak_tags.every((tag) => typeof tag === "string" && tag));
});

test("질문은 앞뒤 공백을 지우고 1~500자만 받는다", () => {
  assert.equal(normalizeQuestion("  ETF 가 뭐야?  "), "ETF 가 뭐야?");
  assert.equal(normalizeQuestion("   "), null);
  assert.equal(normalizeQuestion(42), null);
  assert.equal(normalizeQuestion("가".repeat(QUESTION_MAX_LENGTH)).length, QUESTION_MAX_LENGTH);
  assert.equal(normalizeQuestion("가".repeat(QUESTION_MAX_LENGTH + 1)), null);
});

test("새 대화 제목은 첫 질문 앞 40자, 직접 바꾸는 제목은 1~80자", () => {
  assert.equal(titleFromQuestion("ETF 와\n펀드   차이"), "ETF 와 펀드 차이");
  const long = titleFromQuestion("가".repeat(60));
  assert.equal([...long].length, AUTO_TITLE_LENGTH + 1);
  assert.ok(long.endsWith("…"));
  assert.equal(normalizeTitle("  내 포트폴리오  질문 "), "내 포트폴리오 질문");
  assert.equal(normalizeTitle(""), null);
  assert.equal(normalizeTitle("가".repeat(81)), null);
});

test("대화 id 는 UUID 만, 내역 조회 범위는 1~50 으로 제한한다", () => {
  assert.equal(isConversationId("5f0c2b1e-7a44-4c0e-9d2b-3a1f6e8c9b10"), true);
  assert.equal(isConversationId("0c013ca5e0fe47baab4fb6c47208dcd2"), false);
  assert.equal(isConversationId("' OR 1=1 --"), false);
  assert.equal(clampMessageLimit(null), MESSAGES_DEFAULT_LIMIT);
  assert.equal(clampMessageLimit("0"), MESSAGES_DEFAULT_LIMIT);
  assert.equal(clampMessageLimit("999"), MESSAGES_MAX_LIMIT);
  assert.equal(clampMessageLimit("12"), 12);
  assert.equal(parseBeforeSeq("31"), 31);
  assert.equal(parseBeforeSeq("1"), null);
  assert.equal(parseBeforeSeq("abc"), null);
});

test("RAG 응답에서 답변·상태·문맥을 꺼내고 로그용 필드는 meta 로 모은다", () => {
  const parsed = parseRagChat({
    answer: " 펀드와 ETF는 … ",
    status: "generated",
    state: { turns: 2 },
    needs_portfolio: false,
    route: "rag",
    is_followup: true,
    retrieval_query: "ETF와 펀드의 차이",
    profile: "v2_4j",
    degraded: true,
    latency_s: 5.1,
    conversation_id: "ignored",
  });
  assert.equal(parsed.answer, "펀드와 ETF는 …");
  assert.equal(parsed.status, "generated");
  assert.deepEqual(parsed.state, { turns: 2 });
  assert.equal(parsed.needsPortfolio, false);
  assert.deepEqual(parsed.meta, { status: "generated", route: "rag", is_followup: true, retrieval_query: "ETF와 펀드의 차이", profile: "v2_4j", degraded: true, latency_s: 5.1 });
});

test("답변이 없으면 실패로 보고, 모르는 상태는 generated 로, 너무 큰 문맥은 버린다", () => {
  assert.equal(parseRagChat(null), null);
  assert.equal(parseRagChat({ status: "generated" }), null);
  assert.equal(parseRagChat({ answer: "   " }), null);
  assert.equal(parseRagChat({ answer: "네", status: "something_new" }).status, "generated");
  assert.equal(parseRagChat({ answer: "포트폴리오가 필요해요", status: "portfolio_required", needs_portfolio: true }).needsPortfolio, true);
  assert.equal(parseRagChat({ answer: "네", state: "문자열" }).state, null);
  const huge = parseRagChat({ answer: "네", state: { blob: "x".repeat(STATE_MAX_CHARS) } });
  assert.equal(huge.state, null);
  assert.equal(huge.meta.state_dropped, true);
});

test("RAG 오류는 명세의 HTTP 상태로 바뀐다", () => {
  assert.equal(coachErrorFor("not_configured").status, 503);
  assert.deepEqual([coachErrorFor("warming").status, coachErrorFor("warming").retryAfter], [503, 10]);
  assert.equal(coachErrorFor("timeout").status, 504);
  assert.equal(coachErrorFor("bad_request").status, 400);
  assert.equal(coachErrorFor("upstream").status, 502);
});

test("채팅은 화면·서버·DB 에 연결돼 있다", () => {
  const page = read("../app/page.tsx");
  assert.match(page, /import CoachChat from "\.\/coach-chat";/);
  assert.match(page, /\{tab === "coach" && <CoachChat \/>\}/);
  assert.match(page, /fetch\("\/api\/coach\/health"/);
  assert.match(read("../app/layout.tsx"), /import "\.\/coach-chat\.css";/);

  const db = read("../app/server/db.ts");
  assert.match(db, /CREATE TABLE IF NOT EXISTS turini_conversations[\s\S]*REFERENCES turini_users\(id\) ON DELETE CASCADE/);
  assert.match(db, /CREATE TABLE IF NOT EXISTS turini_messages[\s\S]*REFERENCES turini_conversations\(id\) ON DELETE CASCADE[\s\S]*PRIMARY KEY \(conversation_id, seq\)/);

  const chat = read("../app/api/coach/chat/route.ts");
  // 포트폴리오와 문맥은 브라우저가 아니라 서버가 붙인다.
  assert.match(chat, /buildPortfolioContext\(user\.progress, user\.portfolio\)/);
  assert.doesNotMatch(chat, /body\??\.(portfolio|state)\b/);
  // RAG 키는 서버 모듈에만 있다.
  assert.doesNotMatch(read("../app/coach-chat.tsx"), /RAG_API|X-API-Key/);
  assert.match(read("../app/server/rag-client.ts"), /^import "server-only";/);
});
