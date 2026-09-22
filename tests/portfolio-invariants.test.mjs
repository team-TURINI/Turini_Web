import assert from "node:assert/strict";
import test from "node:test";

import { ASSETS, HORIZON_RANGES, SIGMA_MAX, TYPE_RANGES, allocationTotal, analyzeAllocation, validateAllocation } from "../app/portfolio-rules.ts";

const PROFILES = ["안정형", "중립형", "공격형"];
const HORIZONS = ["1년 미만", "1~3년", "3~10년", "10년 이상"];

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function randomAllocation(random) {
  const cuts = Array.from({ length: 5 }, () => Math.floor(random() * 101)).sort((a, b) => a - b);
  const values = [cuts[0], cuts[1] - cuts[0], cuts[2] - cuts[1], cuts[3] - cuts[2], cuts[4] - cuts[3], 100 - cuts[4]];
  return { domestic: values[0] / 100, overseas: values[1] / 100, bond: values[2] / 100, equityFund: values[3] / 100, cash: values[4] / 100, gold: values[5] / 100 };
}

test("1,500 randomized portfolios preserve v11 calculation invariants", () => {
  const random = randomGenerator(20260922);
  for (let index = 0; index < 1_500; index += 1) {
    const allocation = randomAllocation(random);
    const profile = PROFILES[index % PROFILES.length];
    const horizon = HORIZONS[index % HORIZONS.length];
    assert.equal(validateAllocation(allocation), true);
    const result = analyzeAllocation(allocation, profile, horizon);

    assert.ok(result.riskScore >= 0 && result.riskScore <= SIGMA_MAX);
    assert.ok(result.riskLevel >= 0 && result.riskLevel <= 1);
    assert.ok(result.fit >= 0 && result.fit <= 1);
    assert.ok(result.horizonFit >= 0 && result.horizonFit <= 1);
    assert.ok(result.riskGrade >= 1 && result.riskGrade <= 6);
    assert.ok(result.downside6m <= 0);
    assert.equal("score" in result, false);

    const inType = result.riskScore >= TYPE_RANGES[profile][0] - 0.0001 && result.riskScore <= TYPE_RANGES[profile][1] + 0.0001;
    const inHorizon = result.riskScore >= HORIZON_RANGES[horizon][0] - 0.0001 && result.riskScore <= HORIZON_RANGES[horizon][1] + 0.0001;
    const axes = new Set(result.strengthAxes.map((item) => item.axis));
    assert.equal(axes.has("type_fit"), inType);
    assert.equal(axes.has("horizon_fit"), inHorizon);

    const held = ASSETS.filter((asset) => allocation[asset.key] > 0).length;
    assert.equal(axes.has("diversification"), held >= 2 && result.diversificationStatus === "valid" && result.diversificationReduction > 0);

    if (result.nearTarget) assert.ok(Math.abs(allocationTotal(result.nearTarget.allocation) - 1) < 1e-9);
    if (["hold", "recommended"].includes(result.recommendationStatus)) assert.ok(result.nearTarget);
    else assert.equal(result.nearTarget, null);

    if (result.recommendationStatus === "recommended") {
      for (const item of result.rebalancingActions) assert.ok(Math.abs(item.delta) >= 5);
      for (const item of result.residualItems) assert.ok(Math.abs(item.delta) > 0 && Math.abs(item.delta) < 5);
    } else {
      assert.deepEqual(result.rebalancingActions, []);
      assert.deepEqual(result.residualItems, []);
    }
  }
});
