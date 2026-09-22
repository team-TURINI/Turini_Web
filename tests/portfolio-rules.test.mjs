import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSETS,
  CORRELATION_MATRIX,
  HORIZON_CENTERS,
  HORIZON_RANGES,
  PORTFOLIO_RULE_VERSION,
  RISK_CENTERS,
  SIGMA_MAX,
  TYPE_RANGES,
  allocationTotal,
  analyzeAllocation,
  normalizeAllocation,
  riskGradeFor,
  riskScoreFor,
  targetFor,
  validateAllocation,
} from "../app/portfolio-rules.ts";

const single = (key) => ({ domestic: 0, overseas: 0, bond: 0, equityFund: 0, cash: 0, gold: 0, [key]: 1 });

test("v11 uses the six documented assets, volatilities and correlation matrix", () => {
  assert.deepEqual(ASSETS.map((asset) => asset.label), ["국내주식", "해외주식", "채권", "주식형 ETF·펀드", "현금성자산", "금"]);
  assert.deepEqual(ASSETS.map((asset) => asset.volatility), [33.69, 22.41, 1.69, 15.03, 0.22, 19.4]);
  assert.equal(SIGMA_MAX, 33.69);
  assert.equal(CORRELATION_MATRIX.length, 6);
  assert.ok(CORRELATION_MATRIX.every((row) => row.length === 6));
  assert.equal(riskScoreFor(single("cash")), 0.22);
  assert.equal(riskScoreFor(single("domestic")), 33.69);
});

test("profile and horizon centers reproduce the final document snapshot", () => {
  const expected = { 안정형: 3.9975, 중립형: 9.2223, 공격형: 12.9629 };
  for (const profile of ["안정형", "중립형", "공격형"]) {
    const target = targetFor(profile);
    assert.equal(validateAllocation(target), true);
    assert.ok(Math.abs(allocationTotal(target) - 1) < 1e-9);
    assert.ok(Math.abs(riskScoreFor(target) - expected[profile]) < 0.002);
    assert.ok(Math.abs(RISK_CENTERS[profile] - expected[profile]) < 0.002);
  }
  assert.ok(Math.abs(HORIZON_CENTERS["1년 미만"] - 1.7323) < 0.004);
  assert.deepEqual(Object.keys(HORIZON_RANGES), ["1년 미만", "1~3년", "3~10년", "10년 이상"]);
});

test("service volatility grade boundaries are closed exactly as documented", () => {
  assert.deepEqual(riskGradeFor(0.5), { grade: 6, name: "매우 낮음" });
  assert.deepEqual(riskGradeFor(0.5001), { grade: 5, name: "낮음" });
  assert.equal(riskGradeFor(5).grade, 5);
  assert.equal(riskGradeFor(10).grade, 4);
  assert.equal(riskGradeFor(15).grade, 3);
  assert.equal(riskGradeFor(25).grade, 2);
  assert.equal(riskGradeFor(25.001).grade, 1);
});

test("invalid, non-finite and non-normalized allocations are rejected", () => {
  assert.equal(validateAllocation({ ...single("cash"), cash: 1.01 }), false);
  assert.equal(validateAllocation({ ...single("cash"), cash: Number.NaN }), false);
  assert.equal(validateAllocation({ ...single("cash"), cash: true }), false);
  assert.equal(validateAllocation({ ...single("cash"), extra: 0 }), false);
  assert.throws(() => riskScoreFor({ ...single("cash"), cash: 1.01 }));
  assert.throws(() => analyzeAllocation(single("cash"), "중립형", "5~10년"));
});

test("three independent axes replace the old composite score", () => {
  const result = analyzeAllocation(targetFor("중립형"), "중립형", "3~10년");
  assert.equal("score" in result, false);
  assert.equal(result.fit, 1);
  assert.equal(result.horizonFit, 1);
  assert.equal(result.recommendationStatus, "hold");
  assert.deepEqual(result.strengthAxes.map((item) => item.axis), ["type_fit", "diversification", "horizon_fit"]);
  assert.equal(result.strengths.length, 3);
});

test("single asset does not receive a diversification strength", () => {
  const result = analyzeAllocation(single("equityFund"), "공격형", "10년 이상");
  assert.equal(result.recommendationStatus, "hold");
  assert.equal(result.strengthAxes.some((item) => item.axis === "diversification"), false);
});

test("below-horizon, conflicting and recommended statuses follow the decision table", () => {
  const below = analyzeAllocation(single("cash"), "안정형", "10년 이상");
  assert.equal(below.recommendationStatus, "horizon_below_reference");
  assert.equal(below.nearTarget, null);
  assert.deepEqual(below.rebalancingActions, []);

  const conflict = analyzeAllocation(single("gold"), "중립형", "1년 미만");
  assert.equal(conflict.recommendationStatus, "constraint_conflict");
  assert.equal(conflict.nearTarget, null);

  const recommended = analyzeAllocation(single("domestic"), "안정형", "1~3년");
  assert.equal(recommended.recommendationStatus, "recommended");
  assert.ok(recommended.nearTarget);
  assert.ok(recommended.nearTarget.riskScore >= TYPE_RANGES.안정형[0] && recommended.nearTarget.riskScore <= TYPE_RANGES.안정형[1]);
  assert.ok(recommended.nearTarget.riskScore >= HORIZON_RANGES["1~3년"][0] && recommended.nearTarget.riskScore <= HORIZON_RANGES["1~3년"][1]);
  assert.ok(recommended.rebalancingActions.every((item) => Math.abs(item.delta) >= 5));
});

test("legacy fund allocation migrates and the new rule version invalidates old results", () => {
  const migrated = normalizeAllocation({ domestic: 10, overseas: 20, bond: 30, fund: 20, cash: 10, gold: 10 });
  assert.equal(migrated.equityFund, 0.2);
  assert.equal(allocationTotal(migrated), 1);
  assert.equal(PORTFOLIO_RULE_VERSION, "4.0.0-portfolio-v11-document-snapshot");
});
