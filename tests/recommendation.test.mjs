import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  conceptKey,
  conceptPriority,
  planSessionQuestions,
  recordConceptReview,
} from "../app/quiz-scheduler.ts";

/**
 * 추천이 실제로 사용자 기록에 따라 달라지는지, 서로 다른 이력을 가진
 * 가상 사용자 6명으로 확인합니다. 실제 720문항을 그대로 씁니다.
 */

const pool = JSON.parse(
  await readFile(new URL("../public/data/quizData_720_FINAL.json", import.meta.url), "utf8"),
);
const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

const COUNT = 10;
const SEED = 4242;

/** 그 태그를 쓰는 개념이 실제로 여러 개 있는 태그를 고릅니다 */
const tagCounts = new Map();
for (const item of pool) tagCounts.set(item.weakness_tag, (tagCounts.get(item.weakness_tag) || 0) + 1);
const busyTags = [...tagCounts.entries()].filter(([, n]) => n >= 4).map(([tag]) => tag);
assert.ok(busyTags.length >= 3, "문항이 넉넉한 취약 태그가 있어야 합니다");

const plan = (user) =>
  planSessionQuestions(
    pool,
    COUNT,
    SEED,
    user.reviews ?? {},
    user.studySessions ?? 0,
    user.pendingRetries ?? [],
    user.context,
  );

/** 개념마다 복습 기록을 만들어 줍니다 */
function reviewsFor(baseIds, { correctStreak, nextDueSession }) {
  const reviews = {};
  for (const base of baseIds) reviews[base] = { seen: 3, correctStreak, nextDueSession, lastType: "OX" };
  return reviews;
}

const allBases = [...new Set(pool.map((item) => item.base_id))];

/* ── 가상 사용자 6명 ───────────────────────────────────── */

const 신규 = { name: "신규 사용자", context: undefined };

const 취약태그 = {
  name: "취약 태그가 뚜렷한 사용자",
  context: { weakTags: busyTags.slice(0, 3), level: undefined, recentIds: [] },
};

const 초급 = { name: "초급 학습자", context: { weakTags: [], level: "초급", recentIds: [] } };
const 고급 = { name: "고급 학습자", context: { weakTags: [], level: "고급", recentIds: [] } };

const 숙달자 = {
  name: "대부분 숙달한 사용자",
  studySessions: 30,
  reviews: reviewsFor(allBases.slice(0, 60), { correctStreak: 5, nextDueSession: 99 }),
  context: { weakTags: [], level: "중급", recentIds: [] },
};

const 복습필요 = {
  name: "복습이 밀린 사용자",
  studySessions: 30,
  reviews: reviewsFor(allBases.slice(0, 20), { correctStreak: 0, nextDueSession: 1 }),
  context: { weakTags: [], level: "중급", recentIds: [] },
};

const 사용자들 = [신규, 취약태그, 초급, 고급, 숙달자, 복습필요];

test("서로 다른 이력의 사용자 6명은 서로 다른 문제를 받는다", () => {
  const sets = 사용자들.map((user) => plan(user).map((item) => item.id).join(","));
  assert.equal(sets.length, 6);
  for (const set of sets) assert.equal(set.split(",").length, COUNT);
  // 여섯 명 중 최소 다섯 가지 서로 다른 구성이 나와야 합니다.
  assert.ok(new Set(sets).size >= 5, `추천이 사용자별로 갈리지 않습니다 (${new Set(sets).size}종)`);
});

test("취약 태그에 해당하는 문제가 먼저 나온다", () => {
  const weak = new Set(취약태그.context.weakTags);
  const withContext = plan(취약태그).filter((item) => weak.has(item.weakness_tag)).length;
  const without = plan(신규).filter((item) => weak.has(item.weakness_tag)).length;
  assert.ok(withContext > without, `취약 태그 문항 ${withContext}개 vs 기본 ${without}개`);
  assert.ok(withContext >= 3, "취약 태그 문항이 너무 적습니다");
});

test("현재 난이도에 맞는 문제가 먼저 나온다", () => {
  const 초급사용자 = plan(초급);
  const 고급사용자 = plan(고급);
  const 초급문항 = 초급사용자.filter((item) => item.difficulty === "초급").length;
  const 고급문항 = 고급사용자.filter((item) => item.difficulty === "고급").length;
  const 기본초급 = plan(신규).filter((item) => item.difficulty === "초급").length;
  assert.ok(초급문항 > 기본초급, `초급 ${초급문항} vs 기본 ${기본초급}`);
  assert.ok(고급문항 >= 4, `고급 사용자에게 고급 문항이 ${고급문항}개뿐입니다`);
  // 초급 사용자에게 가는 초급 문항이 고급 사용자에게 가는 초급 문항보다 많아야 합니다.
  const 고급사용자의초급 = 고급사용자.filter((item) => item.difficulty === "초급").length;
  assert.ok(초급문항 > 고급사용자의초급, `초급 ${초급문항} vs 고급 사용자의 초급 ${고급사용자의초급}`);
});

test("이미 숙달한 개념은 우선순위가 내려간다", () => {
  const mastered = new Set(Object.keys(숙달자.reviews));
  const picked = plan(숙달자).filter((item) => mastered.has(conceptKey(item))).length;
  // 60/약 180 개념이 숙달 상태인데, 10문제 중 절반 넘게 나오면 안 됩니다.
  assert.ok(picked <= 4, `숙달 개념이 ${picked}개나 나왔습니다`);
  // 점수 계산으로도 확인합니다.
  const variants = pool.filter((item) => item.base_id === [...mastered][0]);
  const high = conceptPriority(variants, { weakTags: [], level: "중급", recentIds: [] }, undefined);
  const low = conceptPriority(variants, { weakTags: [], level: "중급", recentIds: [] }, {
    seen: 3, correctStreak: 5, nextDueSession: 99, lastType: "OX",
  });
  assert.ok(low < high, "숙달 개념 점수가 내려가지 않습니다");
});

test("너무 최근에 푼 문제는 바로 다시 나오지 않는다", () => {
  const 기본 = plan(초급);
  const recentIds = 기본.map((item) => item.id);
  const 다음 = plan({ ...초급, context: { ...초급.context, recentIds } });
  const 겹침 = 다음.filter((item) => recentIds.includes(item.id)).length;
  assert.ok(겹침 <= 3, `방금 푼 문제가 ${겹침}개나 다시 나왔습니다`);
});

test("복습할 때가 된 개념이 실제로 섞여 나온다", () => {
  const due = new Set(Object.keys(복습필요.reviews));
  const picked = plan(복습필요);
  const 복습수 = picked.filter((item) => due.has(conceptKey(item))).length;
  assert.ok(복습수 >= 1, "복습 문항이 하나도 없습니다");
  // 복습이 전부를 차지하면 새 개념을 못 배웁니다.
  assert.ok(복습수 <= COUNT - 3, `복습이 ${복습수}개로 너무 많습니다`);
  assert.ok(picked.some((item) => item.reviewKind === "scheduled"), "복습 표시가 붙지 않았습니다");
});

test("최근에 틀린 문제는 다음 세션에 다시 나온다", () => {
  const target = pool.find((item) => item.type === "OX");
  const pending = [{
    key: conceptKey(target),
    sourceId: target.id,
    category: target.category,
    difficulty: target.difficulty,
    lastType: target.type,
    dueIndex: 0,
  }];
  const picked = planSessionQuestions(pool, COUNT, SEED, {}, 5, pending, 초급.context);
  const retry = picked.find((item) => item.reviewKind === "retry");
  assert.ok(retry, "오답 복습 문항이 들어가지 않았습니다");
  assert.equal(conceptKey(retry), conceptKey(target));
  // 같은 개념이되 방금 틀린 유형과는 다른 유형으로 다시 물어봅니다.
  assert.notEqual(retry.type, target.type);
});

test("신규·오답·복습이 한쪽으로 쏠리지 않는다", () => {
  const target = pool.find((item) => item.type === "OX");
  const pending = [{
    key: conceptKey(target), sourceId: target.id, category: target.category,
    difficulty: target.difficulty, lastType: target.type, dueIndex: 0,
  }];
  const picked = planSessionQuestions(pool, COUNT, SEED, 복습필요.reviews, 30, pending, 초급.context);
  const retry = picked.filter((item) => item.reviewKind === "retry").length;
  const scheduled = picked.filter((item) => item.reviewKind === "scheduled").length;
  const fresh = picked.length - retry - scheduled;
  assert.equal(picked.length, COUNT);
  assert.ok(retry >= 1, "오답 복습이 없습니다");
  assert.ok(scheduled >= 1, "예정 복습이 없습니다");
  assert.ok(fresh >= 3, `새 문항이 ${fresh}개뿐입니다`);
});

test("정답을 맞히면 다음 복습이 뒤로 밀린다", () => {
  const question = pool[0];
  let progress = { studySessions: 4, conceptReviews: {}, pendingRetries: [] };
  progress = recordConceptReview(progress, question, true);
  const first = progress.conceptReviews[conceptKey(question)];
  assert.equal(first.correctStreak, 1);
  progress = { ...progress, studySessions: 5 };
  progress = recordConceptReview(progress, question, true);
  const second = progress.conceptReviews[conceptKey(question)];
  assert.ok(second.nextDueSession - 5 > first.nextDueSession - 4, "간격이 늘어나지 않았습니다");
  // 틀리면 바로 다시 나옵니다.
  progress = recordConceptReview({ ...progress, studySessions: 6 }, question, false);
  assert.equal(progress.conceptReviews[conceptKey(question)].nextDueSession, 6);
});

test("화면 코드가 추천 기준을 실제로 넘겨 준다", () => {
  assert.match(pageSource, /const recommendation = \{/);
  assert.match(pageSource, /weakTags: progress\.weakTags/);
  assert.match(pageSource, /level: progress\.financeLevel === "진단 전" \? undefined : progress\.financeLevel/);
  assert.match(pageSource, /recentIds: progress\.completedIds\.slice\(-30\)/);
  assert.match(pageSource, /progress\.pendingRetries,\s*\n\s*recommendation,/);
});
