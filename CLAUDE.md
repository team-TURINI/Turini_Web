# CLAUDE.md — Turini_Web 작업 지침

Claude Code 가 매 세션 읽는 프로젝트 컨텍스트입니다. 앱 전반은 `README.md`, 포트폴리오 탭은 이 문서의 §2 를 먼저 읽으세요.

## 1. 레포 개요

Next.js 16 · React 19 모바일 중심 금융 학습 웹앱(투리니). 학습 문항·진단·캐릭터·자산 계획·포트폴리오 탭으로 구성됩니다.

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # node --test tests/*.test.mjs (TS 는 --experimental-strip-types)
npm run lint
```

- `public/data/quizData_720_FINAL.json` · `diagnostic_quiz.json` 은 .gitignore — 데이터는 별도 전달.
- `.env*` 는 절대 커밋·읽기 금지 (`.env.example` 만).
- `tests/profile-avatar.test.mjs` 가 `react`/`typescript` 모듈 미설치 환경에서 실패하는 것은 환경 문제이지 코드 문제가 아닙니다.

## 2. 포트폴리오 탭 — 규칙엔진 v12

| 파일 | 역할 |
|---|---|
| `app/portfolio-rules.ts` | 규칙엔진 (`PORTFOLIO_RULE_VERSION = 5.0.0-portfolio-v12`). σ·역사적 VaR·등급·성향/기간 적합·추천·강점 전부 여기서 |
| `app/portfolio-rules.constants.ts` | **생성 파일. 손으로 고치지 않는다.** 파이썬 테스트 레포 `turini-portfolio-v11` 의 `rules/portfolio_rules_v12.json` 에서 `python scripts/export_web_constants.py` 로 생성 |
| `app/page.tsx` | 결과 화면 (VaR·등급·성향/기간 카드·조정안·`horizon_capped` 고지) |
| `app/api/portfolio-feedback/route.ts` | LLM 피드백. computed 숫자만 인용하도록 allowedNumbers 로 제한 |
| `tests/portfolio-rules.test.mjs` · `portfolio-invariants.test.mjs` | 규칙 회귀 + 불변식 (파이썬 엔진과 300건 교차검증 일치) |
| `docs/PORTFOLIO_V12_SPEC.md` | 앱에 반영된 규칙 기준표 (짧은 버전) |
| `docs/PORTFOLIO_V12_TEST_RESULTS.md` | 테스트 결과 전체 (set1·set2·set3 LLM·골드스탠다드·스케일 분석) |

근거·출처·결정 이유는 파이썬 레포의 `docs/포트폴리오_재건축_v12_최종.md`(노션 「포트폴리오 재건축」 v12)에 있고, 그 레포의 `CLAUDE.md` 가 전체 규칙 요약입니다.

### 핵심 규칙 (한 문단)

종합점수 없음. **손실 위험등급** = 3년 수익률 행렬 R 의 역사적 VaR₉₇.₅(−quantile(R·w, 0.025) × √P) 를 현행 펀드 위험등급과 같은 밴드 1/10/20/30/50% 로 6~1등급. **성향 적합** = σ_p 가 성향 범위(인접 기준배분 σ 의 중간값, 안정 [0, 6.61], 중립 [6.61, 11.09], 공격 [11.09, 15.03]) 안인지. **기간 적합** = σ_p ≤ 기간 상한(2.87 / 6.61 / 11.09 / 15.03) — 상한 조건이라 미달 문구 없음. **추천** = 성향 범위 ∩ [0, 상한] 에서 보유 자산군(+최대 1개, 현금→채권→ETF) 5%p 격자 L1 최소; 성향 하한 ≥ 상한이면 기간 밴드 우선 + `horizon_capped` 고지. **강점** = 성향 적합 · 분산효과(섞어서 등급 한 단계 이상 하락) · 기간 적합, 이 순서로 0~3개.

### 🚫 되돌리지 말 것

- 종합점수·가중치·Excellent~Poor 라벨 · 분산도(HHI)·집중페널티 · 종수/최대비중 신호 재도입
- 등급을 σ 밴드나 1.96σ 정규근사로 되돌리기 (공시 등급과 같은 산출법이어야 골드스탠다드 대조가 성립)
- 기간 적합을 하한 있는 밴드로 되돌리기 · 충돌 시 추천 보류(`horizon_below_reference`·`constraint_conflict`) 재도입
- `portfolio-rules.constants.ts` 손편집 · 숫자 하드코딩 · 런타임 시세 API 호출
- LLM 이 등급·판정·숫자를 바꾸거나 computed 밖의 주의점을 덧붙이는 것

### 상수 갱신 절차 (분기 1회 또는 데이터 교체 시)

파이썬 레포에서 `python engine/build_cov.py && python engine/build_rules.py && python scripts/sync_constants.py && python scripts/export_web_constants.py` → 생성된 `app/portfolio-rules.constants.ts` 를 이 레포에 복사 → `npm test` → `docs/PORTFOLIO_V12_SPEC.md` 의 상수 문단 갱신. 현재 상수는 주간 156개(2026-09-18) 기준 **임시값**이며 일간 종가로 재산출 예정, 금 프록시도 ACE KRX금현물(환노출)로 교체 예정.

## 3. 테스트 현황 (2026-10-03 · 상세 `docs/PORTFOLIO_V12_TEST_RESULTS.md`)

| 묶음 | 결과 |
|---|---|
| 규칙엔진 set1 71건 · set2 12칸 · pytest 198 · 무작위 2만 건 · 756 케이스 | 전부 통과 |
| 웹 TS ↔ 파이썬 교차검증 300건 | σ·VaR·등급·문구·상태·강점·목표 σ 전부 일치 |
| 스케일 (5%p 격자 53,130) | 등급 2:7.3 · 3:41.7 · 4:43.6 · 5:7.3% (1·6등급 희소는 정상) |
| 골드스탠다드 G1 | 파이프라인 완성 · 파일럿 2건 (TDF2040 4=4). 25~30건 수집 남음 |
| LLM set3 (gpt-4.1-mini / 심판 gpt-4.1, K=10) | ① 제약 80% · ② 필수정보 100% · ③ 환각 1.6% · ④ 심판≥4 91.7% · ⑤ 거절 F1 0.957 · ⑥ 일관성 33.3% · ⑦ 태그 F1 0.963 |

LLM 결과 읽는 법: 숫자 오류·판정 뒤바뀜·위험 요청 놓침·공격 성공 전부 0건. 남은 것은 (a) 자동 검사 6건 — 조정안 순서 뒤집음 3, 신호 밖 일반론 주의점 3, (b) 일관성 — 리밸런싱 방향 표현(파서 보완으로 해결 가능)·주의점 개수·기간 문구 의역. 이 레포의 `route.ts` 프롬프트에 반영할 것: 주의점은 발동 신호와 1:1, 조정안은 computed 순서 그대로, 판정 문구는 의역 없이 인용, "엔진이 계산한 등급·자산군 특성 설명은 교육 정보"(과잉거절 방지).

## 4. AI 코치 채팅 (RAG 연동)

포트폴리오 탭 > AI 코치 탭의 채팅. 설계 문서: `docs/ERD.md` · `docs/API_SPEC.md` · `docs/rag/portfolio-context.schema.json`.

- **대화는 앱이 저장한다** (`turini_conversations`, `turini_messages` — `app/server/db.ts` 의 `ensureSchema`). RAG 서버는 저장소가 없고, `POST /chat` 으로 질문·문맥(`state`)·포트폴리오를 받아 답변과 새 `state` 를 돌려준다.
- **브라우저는 RAG 를 직접 부르지 않는다.** `app/api/coach/*` 가 중계하고, `RAG_API_URL`·`RAG_API_KEY` 는 `app/server/rag-client.ts` 에만 있다.
- **포트폴리오 문맥은 서버가 만든다** (`app/coach-context.ts`). 브라우저가 보낸 값이나 저장된 `result` 를 믿지 않고 규칙엔진을 다시 돌린다. 금액(`amount`)과 진단 원점수는 넣지 않는다.
- 문맥 형식을 바꾸면 `docs/rag/portfolio-context.schema.json` · `portfolio-context.example.json` · `PORTFOLIO_CONTEXT_SCHEMA_VERSION` 을 함께 고친다. `tests/coach-chat.test.mjs` 가 예시 파일과 엔진 출력이 같은지 확인한다.
- 로컬 확인: `node scripts/mock-rag.mjs` + `.env.local` 의 `RAG_API_URL=http://localhost:8787`, `RAG_API_KEY=dev-rag-key`.
- RAG 서버 쪽 `/chat` 을 문맥 입출력형으로 바꾸는 작업은 RAG 팀 대기 중 (`docs/API_SPEC.md` 5절). 실제 서버로 붙여 본 적은 아직 없다.
