import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  advanceStreak,
  dateKeyToUtcMs,
  daysBetween,
  displayStreak,
  kstDateKey,
  normalizeStreak,
} from "../app/streak.ts";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

/** 한국 시간 기준 그 날짜의 특정 시각(ms) */
const kst = (key, hour = 12, minute = 0) => {
  const base = dateKeyToUtcMs(key);
  return base + hour * 3600_000 + minute * 60_000;
};

test("날짜는 한국 시간 기준으로 센다", () => {
  // UTC 2026-03-01 15:00 = KST 2026-03-02 00:00
  assert.equal(kstDateKey(Date.UTC(2026, 2, 1, 14, 59)), "2026-03-01");
  assert.equal(kstDateKey(Date.UTC(2026, 2, 1, 15, 0)), "2026-03-02");
  assert.equal(daysBetween("2026-03-01", "2026-03-02"), 1);
  assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1); // 2026년은 윤년이 아님
  assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2); // 2024년은 윤년
});

test("같은 날 여러 번 학습해도 1회만 올라간다", () => {
  let state = advanceStreak({ streak: 0, lastStudyDate: null }, kst("2026-03-10", 9));
  assert.deepEqual(state, { streak: 1, lastStudyDate: "2026-03-10" });
  state = advanceStreak(state, kst("2026-03-10", 13));
  state = advanceStreak(state, kst("2026-03-10", 23, 59));
  assert.deepEqual(state, { streak: 1, lastStudyDate: "2026-03-10" });
});

test("전날 학습 후 다음 날 학습하면 1 늘어난다", () => {
  let state = { streak: 4, lastStudyDate: "2026-03-10" };
  state = advanceStreak(state, kst("2026-03-11", 8));
  assert.deepEqual(state, { streak: 5, lastStudyDate: "2026-03-11" });
  state = advanceStreak(state, kst("2026-03-12", 20));
  assert.equal(state.streak, 6);
});

test("하루 이상 쉬면 1부터 다시 시작한다", () => {
  const state = advanceStreak({ streak: 9, lastStudyDate: "2026-03-10" }, kst("2026-03-12", 10));
  assert.deepEqual(state, { streak: 1, lastStudyDate: "2026-03-12" });
  const longGap = advanceStreak({ streak: 40, lastStudyDate: "2026-01-01" }, kst("2026-03-12"));
  assert.equal(longGap.streak, 1);
});

test("자정 전후에도 정상으로 이어진다", () => {
  // 3월 10일 23:59(KST)에 학습 → 3월 11일 00:01(KST)에 학습하면 이어집니다.
  let state = advanceStreak({ streak: 2, lastStudyDate: "2026-03-09" }, kst("2026-03-10", 23, 59));
  assert.deepEqual(state, { streak: 3, lastStudyDate: "2026-03-10" });
  state = advanceStreak(state, kst("2026-03-11", 0, 1));
  assert.deepEqual(state, { streak: 4, lastStudyDate: "2026-03-11" });
  // 같은 밤이라도 KST 날짜가 그대로면 올라가지 않습니다.
  const sameNight = advanceStreak({ streak: 3, lastStudyDate: "2026-03-10" }, kst("2026-03-10", 23, 58));
  assert.equal(sameNight.streak, 3);
});

test("미래 날짜나 형식이 깨진 값이 들어와도 안전하게 복구한다", () => {
  const future = normalizeStreak({ streak: 99, lastStudyDate: "2099-12-31" }, "2026-03-10");
  assert.deepEqual(future, { streak: 0, lastStudyDate: null });
  assert.deepEqual(normalizeStreak({ streak: 5, lastStudyDate: "2026-02-30" }, "2026-03-10"), {
    streak: 0,
    lastStudyDate: null,
  });
  assert.deepEqual(normalizeStreak({ streak: "많이", lastStudyDate: 12345 }, "2026-03-10"), {
    streak: 0,
    lastStudyDate: null,
  });
  assert.deepEqual(normalizeStreak(null, "2026-03-10"), { streak: 0, lastStudyDate: null });
  // 미래 날짜여도 다시 학습하면 오늘부터 1로 시작합니다.
  assert.deepEqual(advanceStreak({ streak: 99, lastStudyDate: "2099-12-31" }, kst("2026-03-10")), {
    streak: 1,
    lastStudyDate: "2026-03-10",
  });
  // 음수도 막습니다.
  assert.equal(advanceStreak({ streak: -5, lastStudyDate: "2026-03-09" }, kst("2026-03-10")).streak, 2);
});

test("하루를 건너뛰면 화면 숫자도 0으로 내려간다", () => {
  assert.equal(displayStreak({ streak: 7, lastStudyDate: "2026-03-10" }, kst("2026-03-11")), 7);
  assert.equal(displayStreak({ streak: 7, lastStudyDate: "2026-03-10" }, kst("2026-03-12")), 0);
  assert.equal(displayStreak({ streak: 7, lastStudyDate: "2026-03-10" }, kst("2026-03-10")), 7);
});

test("새로고침·재로그인에도 유지되도록 계정 기록에 저장한다", () => {
  // 사용자별 기록(progress)에 마지막 학습일이 들어갑니다 → 서버로 그대로 저장됩니다.
  assert.match(pageSource, /lastStudyDate: string \| null/);
  assert.match(pageSource, /lastStudyDate: null/);
  assert.match(pageSource, /advanceStreak\(\{ streak: current\.streak, lastStudyDate: current\.lastStudyDate \}\)/);
  assert.match(pageSource, /normalizeStreak\(\{ streak: savedProgress\.streak, lastStudyDate: savedProgress\.lastStudyDate \}\)/);
  assert.match(pageSource, /body: JSON\.stringify\(\{\s*progress,/);
  // 화면 숫자만 바꾸는 방식이 아닙니다.
  assert.doesNotMatch(pageSource, /streak: current\.streak \+ 1/);
});

test("진단은 연속 학습으로 세지 않는다", () => {
  assert.match(pageSource, /finished\.mode === "diagnosis"\s*\?\s*\{\}/);
});
