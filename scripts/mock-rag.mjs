/**
 * 가짜 RAG 서버 — 실제 RAG 서버 없이 AI 코치 채팅을 로컬에서 돌려 보기 위한 것.
 *
 *   node scripts/mock-rag.mjs
 *   (.env.local)  RAG_API_URL=http://localhost:8787   RAG_API_KEY=dev-rag-key
 *
 * docs/API_SPEC.md 5절의 형식을 그대로 따른다: 대화를 저장하지 않고, 요청의 state 를 받아 갱신한 state 를 돌려준다.
 * 검색도 LLM 도 없다. 받은 내용을 되짚어 주는 정해진 문장만 답한다.
 *
 * 환경변수 (전부 선택)
 *   MOCK_RAG_PORT      포트 (기본 8787)
 *   RAG_API_KEY        기대하는 X-API-Key (기본 dev-rag-key)
 *   MOCK_RAG_BOOT_MS   띄운 뒤 이 시간 동안 503 을 준다 — "코치를 깨우는 중" 화면 확인용 (기본 0)
 *   MOCK_RAG_DELAY_MS  /chat 응답 지연 — "답변을 쓰고 있어요" 화면 확인용 (기본 1500)
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_RAG_PORT || 8787);
const API_KEY = process.env.RAG_API_KEY || "dev-rag-key";
const BOOT_MS = Number(process.env.MOCK_RAG_BOOT_MS || 0);
const DELAY_MS = Number(process.env.MOCK_RAG_DELAY_MS || 1500);
const RECENT_KEPT = 6;
const startedAt = Date.now();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return null;
  }
}

function answerFor(question, portfolio, turn) {
  if (/^(안녕|하이|hi|hello)/iu.test(question)) {
    return { status: "direct", route: "direct", answer: "안녕하세요! 포트폴리오나 금융 개념이 궁금하면 물어보세요. (가짜 코치)" };
  }
  const asksPortfolio = /내\s*(포트폴리오|배분|비중|자산)|조정안|위험등급/u.test(question);
  if (asksPortfolio && !portfolio) {
    return { status: "portfolio_required", route: "portfolio", needs_portfolio: true, answer: "이 질문에 답하려면 포트폴리오 분석 결과가 필요해요. (가짜 코치)" };
  }
  if (asksPortfolio && portfolio?.computed) {
    const c = portfolio.computed;
    const moves = (c.rebalancing_actions || []).map((a) => `${a.asset_class} ${Math.abs(a.delta_pp)}%p ${a.action}`).join(", ");
    return {
      status: "generated",
      route: "portfolio",
      answer: `지금 배분은 ${c.risk_grade}등급(${c.risk_grade_name})이고, 성향은 '${c.fit_type_label}', 기간은 '${c.fit_horizon_label}'로 나와요.`
        + (moves ? ` 조정안은 ${moves} 방향이에요.` : " 지금은 조정안이 없어요.")
        + " (가짜 코치 — 받은 computed 를 그대로 읽은 답)",
    };
  }
  return { status: "generated", route: "rag", answer: `${turn}번째 질문 "${question}" 을 받았어요. 실제 코치가 연결되면 금융 자료를 찾아 답해 드려요. (가짜 코치)` };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${PORT}`);
  const booting = Date.now() - startedAt < BOOT_MS;

  if (request.method === "GET" && url.pathname === "/health") {
    return booting ? send(response, 503, { status: "starting" }) : send(response, 200, { status: "ok" });
  }

  if (request.method === "POST" && url.pathname === "/chat") {
    if (request.headers["x-api-key"] !== API_KEY) return send(response, 401, { detail: "invalid api key" });
    if (booting) return send(response, 503, { detail: "starting" });
    const body = await readBody(request);
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) return send(response, 422, { detail: "question is required" });

    const previous = body.state && typeof body.state === "object" ? body.state : null;
    const turn = (Number(previous?.turns) || 0) + 1;
    const picked = answerFor(question, body.portfolio, turn);
    await sleep(DELAY_MS);

    const recent = [
      ...(Array.isArray(previous?.recent) ? previous.recent : []),
      { role: "user", content: question },
      { role: "assistant", content: picked.answer },
    ].slice(-RECENT_KEPT);

    console.log(`[mock-rag] turn ${turn} · state ${previous ? "이어감" : "새 대화"} · portfolio ${body.portfolio ? "있음" : "없음"} · ${picked.status}`);
    return send(response, 200, {
      answer: picked.answer,
      status: picked.status,
      // 포트폴리오 값은 문맥에 넣지 않는다 (매 요청에 새로 받는다).
      state: { turns: turn, recent, summary: previous?.summary ?? null },
      needs_portfolio: picked.needs_portfolio === true,
      route: picked.route,
      is_followup: turn > 1,
      retrieval_query: question,
      profile: "mock",
      degraded: false,
      latency_s: DELAY_MS / 1000,
    });
  }

  return send(response, 404, { detail: "not found" });
});

server.listen(PORT, () => {
  console.log(`[mock-rag] http://localhost:${PORT}  (X-API-Key: ${API_KEY}${BOOT_MS ? `, 처음 ${BOOT_MS}ms 는 503` : ""})`);
});
