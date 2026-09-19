import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const feedbackRouteSource = await readFile(new URL("../app/api/portfolio-feedback/route.ts", import.meta.url), "utf8");
const envExampleSource = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const quizData = JSON.parse(await readFile(new URL("../public/data/quizData_720_FINAL.json", import.meta.url), "utf8"));
const spriteSource2 = await readFile(new URL("../app/turini-sprite.tsx", import.meta.url), "utf8");
const avatarSource2 = await readFile(new URL("../app/turini-avatar.tsx", import.meta.url), "utf8");

test("signed-in pages display the active account ID", () => {
  assert.match(pageSource, /account\.username/);
  assert.match(pageSource, /안녕하세요, \{account\.username\}님/);
});

test("new users are routed to diagnosis before the main app", () => {
  assert.match(pageSource, /progress\.financeLevel === "진단 전" && !session && !result/);
  assert.match(pageSource, /진단 테스트 시작하기/);
  assert.match(pageSource, /onClick=\{startDiagnosis\}/);
});

test("account state is saved through the server and old browser demo data is discarded", () => {
  assert.match(pageSource, /fetch\("\/api\/account"/);
  assert.match(pageSource, /method: "PUT"/);
  assert.match(pageSource, /turini-public-progress-v1/);
  assert.match(pageSource, /turini-public-portfolio-v1/);
  assert.doesNotMatch(pageSource, /localStorage\.setItem/);
});

test("GPT portfolio coaching is called through a server-only API route", () => {
  assert.match(pageSource, /fetch\("\/api\/portfolio-feedback"/);
  assert.match(feedbackRouteSource, /process\.env\.OPENAI_API_KEY/);
  assert.match(feedbackRouteSource, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(feedbackRouteSource, /type: "json_schema"/);
  assert.match(feedbackRouteSource, /getCurrentUser/);
  assert.match(feedbackRouteSource, /analyzeAllocation/);
  assert.match(feedbackRouteSource, /브라우저가 보낸 computed는 신뢰하지 않고/);
  assert.match(feedbackRouteSource, /RATE_LIMIT_REQUESTS/);
  assert.match(feedbackRouteSource, /금광기업 주식형 ETF는 금이 아니라/);
  assert.doesNotMatch(pageSource, /sk-[A-Za-z0-9_-]{20,}/);
  assert.match(envExampleSource, /OPENAI_API_KEY=your_api_key_here/);
});

test("portfolio screen exposes the revised asset classification help", () => {
  assert.match(pageSource, /asset-info-button/);
  assert.doesNotMatch(pageSource, /asset-classification-note/);
  assert.match(pageSource, /portfolioRuleVersion: PORTFOLIO_RULE_VERSION/);
  assert.doesNotMatch(pageSource, /분석 가중치/);
  assert.match(pageSource, /종목·업종 내부 집중은 평가하지 않음/);
  assert.match(pageSource, /scoreMax\}점 만점/);
  assert.match(pageSource, /학습용 조정 방향/);
});

test("리밸런싱은 비율과 방향만 알려 주고 금액은 쓰지 않는다", () => {
  // 총 투자금액을 곱해 매수·매도 금액을 보여 주던 부분이 남아 있으면 안 됩니다.
  assert.doesNotMatch(pageSource, /amount \* Math\.abs\(item\.delta\)/);
  assert.doesNotMatch(pageSource, /money\.toLocaleString/);
  assert.doesNotMatch(pageSource, /조정 규모/);
  assert.doesNotMatch(pageSource, /총 투자금액/);
  // 대신 비율 차이와 늘리기·줄이기 방향을 보여 줍니다.
  assert.match(pageSource, /차이 · 방향/);
  assert.match(pageSource, /"늘리기" : "줄이기"/);
  // GPT 답변에도 금액이 섞여 들어오면 규칙 기반 문장으로 되돌립니다.
  assert.match(feedbackRouteSource, /\\d\[\\d,\]\*\\s\*\(원\|만원\|억\)/);
});

test("문제 풀이 후 출처는 화면에 보이지 않지만 데이터에는 남아 있다", () => {
  // 사용자 화면에서 출처 링크를 지웠습니다.
  assert.doesNotMatch(pageSource, /공식 검증 출처/);
  assert.doesNotMatch(pageSource, /href=\{question\.source_url\}/);
  // 데이터의 출처 필드는 그대로 둡니다 (검증·관리자용).
  assert.match(quizData[0].source_url, /^https?:\/\//);
  assert.ok(quizData.every((item) => typeof item.source_name === "string" && item.source_name.length > 0));
});

test("포트폴리오 비중은 슬라이더·숫자·＋/− 세 가지로 함께 입력한다", () => {
  assert.match(pageSource, /setAssetPercent/);
  assert.match(pageSource, /percent-stepper/);
  assert.match(pageSource, /1%p 줄이기/);
  assert.match(pageSource, /1%p 늘리기/);
  // 합계·남은 비율·분석 가능 여부를 한 곳에서 보여 줍니다.
  assert.match(pageSource, /alloc-summary/);
  assert.match(pageSource, /allocationLeft/);
  assert.match(pageSource, /allocationReady/);
  // 합계가 정확히 100%일 때만 분석 버튼이 열립니다.
  assert.match(pageSource, /disabled=\{!allocationReady\}/);
});

test("금액 입력칸은 앞의 0 없이 쉼표로 보여 주고, 설명은 반올림하지 않는다", () => {
  // type="number" 는 "035000" 과 35000 을 같게 보아 화면이 고쳐지지 않습니다.
  const start = pageSource.indexOf("function MoneyField");
  assert.ok(start > 0, "MoneyField 를 찾지 못했습니다");
  const body = pageSource.slice(start, pageSource.indexOf("\nfunction ", start + 10));
  assert.doesNotMatch(body, /type="number"/);
  assert.match(body, /type="text"/);
  assert.match(pageSource, /inputMode="numeric"/);
  assert.match(pageSource, /value=\{value\.toLocaleString\("ko-KR"\)\}/);
  assert.match(pageSource, /replace\(\/\[\^0-9\]\/g, ""\)/);
  // 1억 미만은 만원 단위로 반올림하지 않고 그대로 적습니다.
  assert.doesNotMatch(pageSource, /Math\.round\(absolute \/ 10_000\)/);
  assert.match(pageSource, /const man = Math\.floor\(absolute \/ 10_000\)/);
  assert.match(pageSource, /const rest = absolute % 10_000/);
});

test("애니메이션 그림을 못 읽으면 캐릭터가 사라지지 않고 리그로 대체된다", () => {
  assert.match(spriteSource2, /resolve\(null\)/);
  assert.match(spriteSource2, /onAtlasMissing/);
  assert.match(avatarSource2, /atlasMissing \|\| motion === "idle"/);
});
