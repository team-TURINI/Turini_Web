import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WEALTH_PLANNER,
  futureValue,
  monthsToGoal,
  projectWealth,
  summarizeMonthlyFlow,
} from "../app/wealth-planner.ts";

test("수익률이 0%면 현재 자산과 월 납입 원금의 합이다", () => {
  assert.equal(futureValue(10_000_000, 300_000, 0, 120), 46_000_000);
});

test("양의 수익률에서는 예상자산이 납입원금보다 커진다", () => {
  const projection = projectWealth(DEFAULT_WEALTH_PLANNER);
  assert.ok(projection.total > projection.principal);
  assert.equal(projection.series.length, DEFAULT_WEALTH_PLANNER.years + 1);
});

test("목표를 이미 달성했으면 필요한 기간은 0개월이다", () => {
  assert.equal(monthsToGoal(100_000_000, 0, 5, 100_000_000), 0);
});

test("수입·소비·저축·투자를 중복 없이 구분한다", () => {
  const summary = summarizeMonthlyFlow({
    ...DEFAULT_WEALTH_PLANNER,
    salary: 2_000_000,
    otherIncome: 100_000,
    fixedExpense: 500_000,
    variableExpense: 400_000,
    monthlySavings: 300_000,
    monthlyInvestment: 200_000,
  });
  assert.deepEqual(summary, {
    income: 2_100_000,
    spending: 900_000,
    buildingAssets: 500_000,
    remainder: 700_000,
    assetRate: 500_000 / 2_100_000 * 100,
  });
});
