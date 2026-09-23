export type AssetKey = "domestic" | "overseas" | "bond" | "equityFund" | "cash" | "gold";
export type Allocation = Record<AssetKey, number>;
export type PortfolioType = "안정형" | "중립형" | "공격형";
export type PortfolioTendency = PortfolioType | "진단 전";
export type PortfolioHorizon = "1년 미만" | "1~3년" | "3~10년" | "10년 이상";
export type TraitLevel = "낮음" | "보통" | "높음";
export type SignalKind = "structural" | "caution";
export type RecommendationStatus = "hold" | "recommended" | "horizon_below_reference" | "constraint_conflict" | "no_feasible_target";
export type DiversificationStatus = "valid" | "zero_reference" | "invalid";
export type ModelStatus = "document_snapshot_unverified";
export type Range = readonly [number, number];

export type AssetDefinition = {
  key: AssetKey;
  label: string;
  short: string;
  color: string;
  icon: string;
  volatility: number;
  help: string;
};

export type PortfolioSignal = { id: number; kind: SignalKind; text: string };
export type StrengthAxis = { axis: "type_fit" | "diversification" | "horizon_fit"; sentence: string };

export type TargetSnapshot = {
  allocation: Allocation;
  riskScore: number;
  riskGrade: number;
  riskGradeName: string;
  riskLevel: number;
  downside6m: number;
};

export type PortfolioResult = {
  ruleVersion: string;
  modelStatus: ModelStatus;
  sigmaAsof: string;
  riskScore: number;
  riskGrade: number;
  riskGradeName: string;
  riskLevel: number;
  downside6m: number;
  fit: number;
  horizonFit: number;
  typeFitLabel: string;
  horizonFitLabel: string;
  profileRange: Range;
  horizonRange: Range;
  profileCenter: number;
  horizonCenter: number;
  diversificationReduction: number | null;
  diversificationStatus: DiversificationStatus;
  characteristics: { growth: TraitLevel; defense: TraitLevel; liquidity: TraitLevel };
  recommendationStatus: RecommendationStatus;
  nearTarget: TargetSnapshot | null;
  baseTarget: TargetSnapshot;
  rebalancingActions: { asset: AssetKey; delta: number; action: "확대" | "축소" }[];
  residualItems: { asset: AssetKey; delta: number }[];
  signals: PortfolioSignal[];
  strengthAxes: StrengthAxis[];
  strengths: string[];
  cautions: string[];
  unlockTags: string[];
  coach: string;
};

export const PORTFOLIO_RULE_VERSION = "4.0.0-portfolio-v11-document-snapshot";
export const PORTFOLIO_MODEL_STATUS: ModelStatus = "document_snapshot_unverified";
export const PORTFOLIO_SIGMA_ASOF = "2026-09-18";
export const MODEL_LIMITATION = "첨부된 v11 최종 문서의 변동성·상관계수 스냅샷으로 계산해요. 원시 시계열과 운영용 공분산 상수의 재현 검증은 아직 남아 있어요.";

export const ASSETS: AssetDefinition[] = [
  { key: "domestic", label: "국내주식", short: "국내", color: "#58cc02", icon: "KR", volatility: 33.69, help: "국내 거래소에 상장된 개별기업 주식의 합계예요. 국내 주식형 ETF·펀드는 ‘주식형 ETF·펀드’에 입력해 주세요." },
  { key: "overseas", label: "해외주식", short: "해외", color: "#1cb0f6", icon: "GL", volatility: 22.41, help: "해외 거래소에 상장된 개별기업 주식의 합계예요. 환율·국가 위험도 함께 반영하고, 해외 주식형 ETF·펀드는 별도 항목에 입력해 주세요." },
  { key: "bond", label: "채권", short: "채권", color: "#9069e7", icon: "B", volatility: 1.69, help: "직접채권과 일반 채권 ETF·채권형 펀드를 합산해요. 장기채·하이일드·환노출 해외채권은 실제 위험도가 대표값보다 높을 수 있어요." },
  { key: "equityFund", label: "주식형 ETF·펀드", short: "주식형", color: "#ff9600", icon: "F", volatility: 15.03, help: "주식에 주로 투자하는 ETF·펀드예요. 국내·해외 지수형, 액티브형, 섹터·테마형을 포함하고 레버리지·인버스 상품은 제외해요." },
  { key: "cash", label: "현금성자산", short: "현금", color: "#2bb6a8", icon: "₩", volatility: 0.22, help: "현금, 입출금·단기 예금, CMA·MMF처럼 비교적 빠르게 사용할 수 있는 자산이에요. 상품마다 원금보장·예금자보호 여부는 달라요." },
  { key: "gold", label: "금", short: "금", color: "#ffc800", icon: "Au", volatility: 19.4, help: "실물 금, 금 통장과 금 현물·선물 가격을 추종하는 일반 상품을 합산해요. 금광기업 주식형과 레버리지·인버스 상품은 포함하지 않아요." },
];

export const ASSET_KEYS = ASSETS.map((asset) => asset.key) as AssetKey[];
const MODEL_ORDER: AssetKey[] = ["domestic", "overseas", "equityFund", "bond", "cash", "gold"];
const VOLATILITY = Object.fromEntries(ASSETS.map((asset) => [asset.key, asset.volatility])) as Record<AssetKey, number>;
export const SIGMA_MAX = Math.max(...ASSETS.map((asset) => asset.volatility));

export const CORRELATION_MATRIX: readonly (readonly number[])[] = [
  [1, 0.15, 0.69, 0.16, 0.04, 0.17],
  [0.15, 1, 0.49, -0.03, -0.01, -0.01],
  [0.69, 0.49, 1, 0.09, 0.02, 0.12],
  [0.16, -0.03, 0.09, 1, 0.53, 0.22],
  [0.04, -0.01, 0.02, 0.53, 1, 0.15],
  [0.17, -0.01, 0.12, 0.22, 0.15, 1],
] as const;

export const EMPTY_ALLOCATION: Allocation = { domestic: 0.125, overseas: 0.25, bond: 0.35, equityFund: 0.125, cash: 0.1, gold: 0.05 };

const BASE_TARGETS: Record<PortfolioType, Allocation> = {
  안정형: { domestic: 0.05, overseas: 0.1, equityFund: 0.05, bond: 0.45, cash: 0.3, gold: 0.05 },
  중립형: { domestic: 0.125, overseas: 0.25, equityFund: 0.125, bond: 0.35, cash: 0.1, gold: 0.05 },
  공격형: { domestic: 0.175, overseas: 0.35, equityFund: 0.175, bond: 0.15, cash: 0.05, gold: 0.1 },
};
const SHORT_HORIZON_TARGET: Allocation = { domestic: 0, overseas: 0, equityFund: 0, bond: 0.5625, cash: 0.375, gold: 0.0625 };

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && !Number.isNaN(value);
}
function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeAllocation(value: unknown): Allocation {
  const saved = value && typeof value === "object" ? value as Partial<Allocation> & { fund?: number } : {};
  const rawValues = ASSET_KEYS.map((key) => key === "equityFund" ? saved.equityFund ?? saved.fund : saved[key]);
  const usesLegacyPercent = rawValues.some((candidate) => finiteNumber(candidate) && candidate > 1);
  const numberOr = (candidate: unknown, fallback: number) => finiteNumber(candidate)
    ? Math.min(1, Math.max(0, candidate / (usesLegacyPercent ? 100 : 1))) : fallback;
  return {
    domestic: numberOr(saved.domestic, EMPTY_ALLOCATION.domestic),
    overseas: numberOr(saved.overseas, EMPTY_ALLOCATION.overseas),
    bond: numberOr(saved.bond, EMPTY_ALLOCATION.bond),
    equityFund: numberOr(saved.equityFund ?? saved.fund, EMPTY_ALLOCATION.equityFund),
    cash: numberOr(saved.cash, EMPTY_ALLOCATION.cash),
    gold: numberOr(saved.gold, EMPTY_ALLOCATION.gold),
  };
}

export function allocationTotal(allocation: Allocation) { return ASSET_KEYS.reduce((sum, key) => sum + allocation[key], 0); }

export function validateAllocation(allocation: unknown): allocation is Allocation {
  if (!allocation || typeof allocation !== "object" || Array.isArray(allocation)) return false;
  const row = allocation as Record<string, unknown>;
  if (Object.keys(row).some((key) => !ASSET_KEYS.includes(key as AssetKey))) return false;
  if (!ASSET_KEYS.every((key) => finiteNumber(row[key]) && row[key] >= 0 && row[key] <= 1)) return false;
  return Math.abs(ASSET_KEYS.reduce((sum, key) => sum + (row[key] as number), 0) - 1) < 1e-9;
}

export function targetFor(tendency: PortfolioTendency): Allocation {
  const profile = tendency === "진단 전" ? "중립형" : tendency;
  return { ...BASE_TARGETS[profile] };
}

function portfolioVolatilityRaw(allocation: Allocation) {
  let variance = 0;
  MODEL_ORDER.forEach((left, i) => MODEL_ORDER.forEach((right, j) => {
    variance += allocation[left] * allocation[right] * VOLATILITY[left] * VOLATILITY[right] * CORRELATION_MATRIX[i][j];
  }));
  return Math.sqrt(Math.max(0, variance));
}

export function riskScoreFor(allocation: Allocation) {
  if (!validateAllocation(allocation)) throw new Error("자산 비중은 0.0~1.0의 숫자이고 합계가 1.0이어야 해요.");
  return round(portfolioVolatilityRaw(allocation), 4);
}

export function riskGradeFor(volatility: number) {
  if (!finiteNumber(volatility) || volatility < 0) throw new Error("변동성은 0 이상의 숫자여야 해요.");
  if (volatility <= 0.5) return { grade: 6, name: "매우 낮음" };
  if (volatility <= 5) return { grade: 5, name: "낮음" };
  if (volatility <= 10) return { grade: 4, name: "보통" };
  if (volatility <= 15) return { grade: 3, name: "다소 높음" };
  if (volatility <= 25) return { grade: 2, name: "높음" };
  return { grade: 1, name: "매우 높음" };
}

function downside6mFor(volatility: number) { return Math.expm1(-1.645 * (volatility / 100) * Math.sqrt(26 / 52)) * 100; }

export const RISK_CENTERS: Record<PortfolioType, number> = {
  안정형: portfolioVolatilityRaw(BASE_TARGETS.안정형),
  중립형: portfolioVolatilityRaw(BASE_TARGETS.중립형),
  공격형: portfolioVolatilityRaw(BASE_TARGETS.공격형),
};
const TYPE_MID_1 = (RISK_CENTERS.안정형 + RISK_CENTERS.중립형) / 2;
const TYPE_MID_2 = (RISK_CENTERS.중립형 + RISK_CENTERS.공격형) / 2;
export const TYPE_RANGES: Record<PortfolioType, Range> = {
  안정형: [0, TYPE_MID_1], 중립형: [TYPE_MID_1, TYPE_MID_2], 공격형: [TYPE_MID_2, VOLATILITY.equityFund],
};

export const HORIZON_CENTERS: Record<PortfolioHorizon, number> = {
  "1년 미만": portfolioVolatilityRaw(SHORT_HORIZON_TARGET),
  "1~3년": RISK_CENTERS.안정형,
  "3~10년": RISK_CENTERS.중립형,
  "10년 이상": RISK_CENTERS.공격형,
};
const HORIZON_MID_1 = (HORIZON_CENTERS["1년 미만"] + HORIZON_CENTERS["1~3년"]) / 2;
export const HORIZON_RANGES: Record<PortfolioHorizon, Range> = {
  "1년 미만": [0, HORIZON_MID_1], "1~3년": [HORIZON_MID_1, TYPE_MID_1],
  "3~10년": [TYPE_MID_1, TYPE_MID_2], "10년 이상": [TYPE_MID_2, VOLATILITY.equityFund],
};

function trait(value: number, low: number, high: number): TraitLevel {
  if (value < low) return "낮음";
  if (value > high) return "높음";
  return "보통";
}

function fitFor(value: number, range: Range, centers: number[], centerIndex: number, dimension: "type" | "horizon") {
  if (value >= range[0] && value <= range[1]) return { fit: 1, label: dimension === "type" ? "성향 범위에 적합" : "기간 범위에 적합" };
  const lowerGap = centerIndex > 0 ? centers[centerIndex] - centers[centerIndex - 1] : centers[1] - centers[0];
  const upperGap = centerIndex < centers.length - 1 ? centers[centerIndex + 1] - centers[centerIndex] : centers.at(-1)! - centers.at(-2)!;
  const below = value < range[0];
  const distance = below ? range[0] - value : value - range[1];
  const fit = Math.max(0, 1 - distance / (below ? lowerGap : upperGap));
  const degree = fit >= 0.5 ? "다소" : "매우";
  return { fit, label: dimension === "type" ? `${degree} ${below ? "안정적" : "공격적"}` : `기간 대비 위험이 ${degree} ${below ? "낮음" : "높음"}` };
}

function snapshot(allocation: Allocation): TargetSnapshot {
  const raw = portfolioVolatilityRaw(allocation);
  const grade = riskGradeFor(raw);
  return { allocation: { ...allocation }, riskScore: round(raw, 4), riskGrade: grade.grade, riskGradeName: grade.name, riskLevel: round(raw / SIGMA_MAX, 4), downside6m: round(downside6mFor(raw), 2) };
}

type Candidate = { allocation: Allocation; risk: number };
const gridCache = new Map<number, Candidate[]>();
function maskFor(keys: AssetKey[]) { return keys.reduce((mask, key) => mask | (1 << ASSET_KEYS.indexOf(key)), 0); }
function gridForMask(mask: number) {
  const cached = gridCache.get(mask);
  if (cached) return cached;
  const rows: Candidate[] = [];
  const units = Array<number>(ASSET_KEYS.length).fill(0);
  const walk = (index: number, remaining: number) => {
    if (index === ASSET_KEYS.length - 1) {
      if (!(mask & (1 << index)) && remaining !== 0) return;
      units[index] = remaining;
      const allocation = Object.fromEntries(ASSET_KEYS.map((key, i) => [key, units[i] / 20])) as Allocation;
      rows.push({ allocation, risk: portfolioVolatilityRaw(allocation) });
      return;
    }
    if (!(mask & (1 << index))) { units[index] = 0; walk(index + 1, remaining); return; }
    for (let value = 0; value <= remaining; value += 1) { units[index] = value; walk(index + 1, remaining - value); }
  };
  walk(0, 20);
  rows.sort((left, right) => left.risk - right.risk);
  gridCache.set(mask, rows);
  return rows;
}
function candidatesInRange(rows: Candidate[], range: Range) { return rows.filter((candidate) => candidate.risk >= range[0] - 1e-12 && candidate.risk <= range[1] + 1e-12); }
function compareTuple(left: Allocation, right: Allocation) {
  for (const key of MODEL_ORDER) { const difference = left[key] - right[key]; if (Math.abs(difference) > 1e-12) return difference; }
  return 0;
}
function bestCandidate(candidates: Candidate[], current: Allocation, profileCenter: number) {
  const held = new Set(ASSET_KEYS.filter((key) => current[key] > 1e-12));
  return [...candidates].sort((left, right) => {
    const leftL1 = ASSET_KEYS.reduce((sum, key) => sum + Math.abs(left.allocation[key] - current[key]), 0);
    const rightL1 = ASSET_KEYS.reduce((sum, key) => sum + Math.abs(right.allocation[key] - current[key]), 0);
    const leftAdded = ASSET_KEYS.filter((key) => left.allocation[key] > 0 && !held.has(key)).length;
    const rightAdded = ASSET_KEYS.filter((key) => right.allocation[key] > 0 && !held.has(key)).length;
    return leftL1 - rightL1 || leftAdded - rightAdded || Math.abs(left.risk - profileCenter) - Math.abs(right.risk - profileCenter) || compareTuple(left.allocation, right.allocation);
  })[0];
}

function recommendationFor(current: Allocation, currentRisk: number, profileRange: Range, horizonRange: Range, profileCenter: number) {
  const inType = currentRisk >= profileRange[0] && currentRisk <= profileRange[1];
  const inHorizon = currentRisk >= horizonRange[0] && currentRisk <= horizonRange[1];
  if (inType && inHorizon) return { status: "hold" as const, allocation: current };
  if (inType && currentRisk < horizonRange[0]) return { status: "horizon_below_reference" as const, allocation: null };
  const intersection: Range = [Math.max(profileRange[0], horizonRange[0]), Math.min(profileRange[1], horizonRange[1])];
  if (intersection[0] > intersection[1] + 1e-12) return { status: "constraint_conflict" as const, allocation: null };
  const held = ASSET_KEYS.filter((key) => current[key] > 1e-12);
  const masks: number[] = [];
  for (const addition of [null, "cash", "bond", "equityFund"] as const) {
    const keys = addition && !held.includes(addition) ? [...held, addition] : held;
    const mask = maskFor(keys);
    if (!masks.includes(mask)) masks.push(mask);
  }
  for (const mask of masks) {
    const outer = candidatesInRange(gridForMask(mask), intersection);
    if (!outer.length) continue;
    const inset = (intersection[1] - intersection[0]) * 0.1;
    const inner: Range = [intersection[0] + inset, intersection[1] - inset];
    const preferred = inner[0] <= inner[1] ? outer.filter((candidate) => candidate.risk >= inner[0] && candidate.risk <= inner[1]) : [];
    return { status: "recommended" as const, allocation: bestCandidate(preferred.length ? preferred : outer, current, profileCenter).allocation };
  }
  return { status: "no_feasible_target" as const, allocation: null };
}

function allocationMetrics(allocation: Allocation) { return { growth: allocation.domestic + allocation.overseas + allocation.equityFund, defense: allocation.bond + allocation.cash, cash: allocation.cash }; }
function allocationSignalIds(allocation: Allocation) {
  const metrics = allocationMetrics(allocation);
  const ids: number[] = [];
  if (metrics.growth < 0.35) ids.push(1);
  if (metrics.growth > 0.6) ids.push(2);
  if (metrics.defense < 0.325) ids.push(3);
  if (metrics.defense > 0.6) ids.push(4);
  if (metrics.cash < 0.075) ids.push(5);
  if (metrics.cash > 0.2) ids.push(6);
  return ids;
}
const SIGNAL_META: Record<number, { metric: "growth" | "defense" | "cash"; direction: "low" | "high"; text: string }> = {
  1: { metric: "growth", direction: "low", text: "성장자산 비중이 35%보다 낮아요." },
  2: { metric: "growth", direction: "high", text: "성장자산 비중이 60%보다 높아요." },
  3: { metric: "defense", direction: "low", text: "방어자산 비중이 32.5%보다 낮아요." },
  4: { metric: "defense", direction: "high", text: "방어자산 비중이 60%보다 높아요." },
  5: { metric: "cash", direction: "low", text: "현금성자산 비중이 7.5%보다 낮아요." },
  6: { metric: "cash", direction: "high", text: "현금성자산 비중이 20%보다 높아요." },
};
function signalKind(id: number, current: Allocation, baseTarget: Allocation): SignalKind {
  if (!allocationSignalIds(baseTarget).includes(id)) return "caution";
  const meta = SIGNAL_META[id];
  const currentValue = allocationMetrics(current)[meta.metric];
  const targetValue = allocationMetrics(baseTarget)[meta.metric];
  return (meta.direction === "high" ? currentValue > targetValue : currentValue < targetValue) ? "caution" : "structural";
}

const UNLOCK_TAG_BY_ASSET: Record<AssetKey, string> = {
  domestic: "주식의 개념", overseas: "자산군별 장기 수익", equityFund: "인덱스 ETF 분산효과",
  bond: "채권의 개념", cash: "원금 손실 위험", gold: "분산투자 기본 원리",
};
const STATUS_COACH: Record<RecommendationStatus, string> = {
  hold: "성향과 기간 기준 범위에 모두 들어와 지금 비중을 유지해도 좋아요.",
  recommended: "성향과 기간 기준이 겹치는 범위 안에서 5% 단위의 가까운 학습용 배분을 찾아봤어요.",
  horizon_below_reference: "성향 기준에는 맞지만 기간 기준보다 위험이 낮아요. 위험을 억지로 높이는 조정안은 제시하지 않아요.",
  constraint_conflict: "성향 기준과 기간 기준 범위가 겹치지 않아 하나의 조정안으로 정하지 않아요.",
  no_feasible_target: "현재 보유 자산과 한 종류 추가 조건으로는 5% 단위 조정안을 찾지 못했어요.",
};

export function analyzeAllocation(current: Allocation, tendency: PortfolioTendency, horizon: string): PortfolioResult {
  if (!validateAllocation(current)) throw new Error("자산 비중은 0.0~1.0의 숫자이고 합계가 1.0이어야 해요.");
  if (!(horizon in HORIZON_CENTERS)) throw new Error("지원하지 않는 투자 기간이에요.");
  const profile: PortfolioType = tendency === "진단 전" ? "중립형" : tendency;
  const typedHorizon = horizon as PortfolioHorizon;
  const currentRiskRaw = portfolioVolatilityRaw(current);
  const grade = riskGradeFor(currentRiskRaw);
  const profileOrder: PortfolioType[] = ["안정형", "중립형", "공격형"];
  const horizonOrder: PortfolioHorizon[] = ["1년 미만", "1~3년", "3~10년", "10년 이상"];
  const profileRange = TYPE_RANGES[profile];
  const horizonRange = HORIZON_RANGES[typedHorizon];
  const typeFit = fitFor(currentRiskRaw, profileRange, profileOrder.map((key) => RISK_CENTERS[key]), profileOrder.indexOf(profile), "type");
  const periodFit = fitFor(currentRiskRaw, horizonRange, horizonOrder.map((key) => HORIZON_CENTERS[key]), horizonOrder.indexOf(typedHorizon), "horizon");
  const volatilityBudget = ASSET_KEYS.reduce((sum, key) => sum + current[key] * VOLATILITY[key], 0);
  let diversificationStatus: DiversificationStatus = "valid";
  let diversificationReduction: number | null = null;
  if (!finiteNumber(volatilityBudget) || !finiteNumber(currentRiskRaw)) diversificationStatus = "invalid";
  else if (volatilityBudget <= 1e-12) diversificationStatus = "zero_reference";
  else diversificationReduction = Math.max(0, Math.min(1, 1 - currentRiskRaw / volatilityBudget));
  const heldCount = ASSET_KEYS.filter((key) => current[key] > 1e-12).length;
  const strengthAxes: StrengthAxis[] = [];
  if (typeFit.fit === 1) strengthAxes.push({ axis: "type_fit", sentence: `연환산 변동성 ${round(currentRiskRaw, 2)}%가 ${profile} 기준 범위 ${round(profileRange[0], 2)}~${round(profileRange[1], 2)}% 안에 들어와요.` });
  if (heldCount >= 2 && diversificationStatus === "valid" && diversificationReduction !== null && diversificationReduction > 1e-12) strengthAxes.push({ axis: "diversification", sentence: `보유 자산 ${heldCount}종의 상관관계를 반영하면 단순 가중 변동성 합계보다 ${round(diversificationReduction * 100, 1)}% 낮아지는 분산 효과가 보여요.` });
  if (periodFit.fit === 1) strengthAxes.push({ axis: "horizon_fit", sentence: `연환산 변동성 ${round(currentRiskRaw, 2)}%가 ${typedHorizon} 기간 기준 범위 ${round(horizonRange[0], 2)}~${round(horizonRange[1], 2)}% 안에 들어와요.` });
  const baseTarget = BASE_TARGETS[profile];
  const signals = allocationSignalIds(current).map((id) => ({ id, kind: signalKind(id, current, baseTarget), text: SIGNAL_META[id].text }));
  const cautions = [
    ...(typeFit.fit < 1 ? [`성향 판정은 ${typeFit.label}이에요.`] : []),
    ...(periodFit.fit < 1 ? [`기간 판정은 ${periodFit.label}이에요.`] : []),
    ...signals.filter((signal) => signal.kind === "caution").map((signal) => signal.text),
  ];
  const recommendation = recommendationFor(current, currentRiskRaw, profileRange, horizonRange, RISK_CENTERS[profile]);
  const nearTarget = recommendation.allocation ? snapshot(recommendation.allocation) : null;
  const allDeltas = nearTarget ? ASSET_KEYS.map((asset) => ({ asset, delta: round((nearTarget.allocation[asset] - current[asset]) * 100, 1) })) : [];
  const rebalancingActions = recommendation.status === "recommended" ? allDeltas.filter((item) => Math.abs(item.delta) >= 5).map((item) => ({ ...item, action: (item.delta > 0 ? "확대" : "축소") as "확대" | "축소" })) : [];
  const residualItems = recommendation.status === "recommended" ? allDeltas.filter((item) => Math.abs(item.delta) > 0 && Math.abs(item.delta) < 5) : [];
  const unlockTags = recommendation.status === "recommended" && nearTarget ? ASSET_KEYS.filter((key) => current[key] <= 1e-12 && nearTarget.allocation[key] > 0).map((key) => UNLOCK_TAG_BY_ASSET[key]) : [];
  const metrics = allocationMetrics(current);
  return {
    ruleVersion: PORTFOLIO_RULE_VERSION, modelStatus: PORTFOLIO_MODEL_STATUS, sigmaAsof: PORTFOLIO_SIGMA_ASOF,
    riskScore: round(currentRiskRaw, 4), riskGrade: grade.grade, riskGradeName: grade.name,
    riskLevel: round(currentRiskRaw / SIGMA_MAX, 4), downside6m: round(downside6mFor(currentRiskRaw), 2),
    fit: round(typeFit.fit, 4), horizonFit: round(periodFit.fit, 4), typeFitLabel: typeFit.label, horizonFitLabel: periodFit.label,
    profileRange, horizonRange, profileCenter: round(RISK_CENTERS[profile], 4), horizonCenter: round(HORIZON_CENTERS[typedHorizon], 4),
    diversificationReduction: diversificationReduction === null ? null : round(diversificationReduction, 4), diversificationStatus,
    characteristics: { growth: trait(metrics.growth, 0.35, 0.6), defense: trait(metrics.defense, 0.325, 0.6), liquidity: trait(metrics.cash, 0.075, 0.2) },
    recommendationStatus: recommendation.status, nearTarget, baseTarget: snapshot(baseTarget), rebalancingActions, residualItems, signals,
    strengthAxes, strengths: strengthAxes.map((axis) => axis.sentence), cautions, unlockTags, coach: STATUS_COACH[recommendation.status],
  };
}
