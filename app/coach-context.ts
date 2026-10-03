/**
 * AI 코치 채팅 — RAG 서버로 보내는 포트폴리오 문맥.
 *
 * 형식은 docs/rag/portfolio-context.schema.json 이 원본이다. 필드를 바꾸면 스키마와 SCHEMA_VERSION 을 함께 올린다.
 * 금액(amount)과 진단 원점수는 넣지 않는다. computed 는 저장된 결과를 믿지 않고 항상 규칙엔진으로 다시 계산한다.
 */
import {
  ASSETS,
  OK_HORIZON_LABEL,
  OK_TYPE_LABEL,
  PORTFOLIO_RULE_VERSION,
  analyzeAllocation,
  validateAllocation,
  type Allocation,
  type PortfolioSignal,
  type PortfolioType,
  type RecommendationStatus,
  type TargetSnapshot,
  type TraitLevel,
} from "./portfolio-rules.ts";

export const PORTFOLIO_CONTEXT_SCHEMA_VERSION = "turini-portfolio-context/1";

const HORIZONS = ["1년 미만", "1~3년", "3~10년", "10년 이상"] as const;
const RISK_TYPES = ["안정형", "중립형", "공격형"] as const;
const LEVEL_TYPES = ["초급", "중급", "고급"] as const;
const MAX_WEAK_TAGS = 10;

type AllocationByLabel = Record<string, number>;

type TargetContext = {
  allocation: AllocationByLabel;
  risk_score: number;
  risk_var: number;
  risk_grade: number;
  risk_grade_name: string;
  downside_6m: number;
};

export type PortfolioContext = {
  schema_version: typeof PORTFOLIO_CONTEXT_SCHEMA_VERSION;
  diagnosis: {
    diagnosed: boolean;
    risk_type: PortfolioType;
    level_type: (typeof LEVEL_TYPES)[number] | null;
    weak_tags: string[];
  };
  portfolio: {
    input_mode: "실제" | "연습";
    investment_horizon: (typeof HORIZONS)[number];
    allocation: AllocationByLabel;
  };
  computed: {
    engine_version: string;
    sigma_asof: string;
    risk_score: number;
    risk_var: number;
    risk_grade: number;
    risk_grade_name: string;
    downside_6m: number;
    fit_type_ok: boolean;
    fit_type_label: string;
    type_range: [number, number];
    fit_horizon_ok: boolean;
    fit_horizon_label: string;
    horizon_cap: number;
    characteristics: { growth: TraitLevel; defense: TraitLevel; liquidity: TraitLevel };
    recommendation_status: RecommendationStatus;
    near_target: TargetContext | null;
    base_target: TargetContext;
    rebalancing_actions: { asset_class: string; delta_pp: number; action: "확대" | "축소" }[];
    signals: PortfolioSignal[];
    strengths: string[];
    cautions: string[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** 자산군 키 → 한글 이름. 비율이 0 인 자산군은 뺀다. */
function allocationByLabel(allocation: Allocation): AllocationByLabel {
  return Object.fromEntries(
    ASSETS.filter((asset) => allocation[asset.key] > 1e-12)
      .map((asset) => [asset.label, Math.round(allocation[asset.key] * 10_000) / 10_000]),
  );
}

function targetContext(target: TargetSnapshot): TargetContext {
  return {
    allocation: allocationByLabel(target.allocation),
    risk_score: round2(target.riskScore),
    risk_var: round2(target.riskVar),
    risk_grade: target.riskGrade,
    risk_grade_name: target.riskGradeName,
    downside_6m: round2(target.downside6m),
  };
}

/**
 * 계정에 저장된 progress · portfolio 로 문맥을 만든다.
 * 분석을 한 번도 하지 않았거나, 저장된 결과가 예전 엔진 버전이거나, 입력값이 유효하지 않으면 null.
 * null 이면 RAG 에 portfolio 를 보내지 않고, 포트폴리오가 필요한 질문에는 RAG 가 portfolio_required 로 답한다.
 */
export function buildPortfolioContext(progress: unknown, portfolio: unknown): PortfolioContext | null {
  if (!isRecord(portfolio)) return null;
  if (!isRecord(portfolio.result) || portfolio.ruleVersion !== PORTFOLIO_RULE_VERSION) return null;
  if (!validateAllocation(portfolio.allocation)) return null;
  const horizon = HORIZONS.find((item) => item === portfolio.horizon);
  if (!horizon) return null;

  const saved = isRecord(progress) ? progress : {};
  const diagnosedType = RISK_TYPES.find((item) => item === saved.tendency);
  const riskType: PortfolioType = diagnosedType ?? "중립형";
  const levelType = LEVEL_TYPES.find((item) => item === saved.financeLevel) ?? null;
  const weakTags = Array.isArray(saved.weakTags)
    ? saved.weakTags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0).slice(-MAX_WEAK_TAGS)
    : [];

  const allocation = portfolio.allocation;
  const computed = analyzeAllocation(allocation, riskType, horizon);
  const labelByKey = Object.fromEntries(ASSETS.map((asset) => [asset.key, asset.label]));
  const hasAdjustment = computed.recommendationStatus === "recommended" || computed.recommendationStatus === "horizon_capped";

  return {
    schema_version: PORTFOLIO_CONTEXT_SCHEMA_VERSION,
    diagnosis: {
      diagnosed: Boolean(diagnosedType),
      risk_type: riskType,
      level_type: levelType,
      weak_tags: weakTags,
    },
    portfolio: {
      input_mode: portfolio.inputMode === "practice" ? "연습" : "실제",
      investment_horizon: horizon,
      allocation: allocationByLabel(allocation),
    },
    computed: {
      engine_version: computed.ruleVersion,
      sigma_asof: computed.sigmaAsof,
      risk_score: round2(computed.riskScore),
      risk_var: round2(computed.riskVar),
      risk_grade: computed.riskGrade,
      risk_grade_name: computed.riskGradeName,
      downside_6m: round2(computed.downside6m),
      fit_type_ok: computed.typeFitLabel === OK_TYPE_LABEL,
      fit_type_label: computed.typeFitLabel,
      type_range: [round2(computed.profileRange[0]), round2(computed.profileRange[1])],
      fit_horizon_ok: computed.horizonFitLabel === OK_HORIZON_LABEL,
      fit_horizon_label: computed.horizonFitLabel,
      horizon_cap: round2(computed.horizonCap),
      characteristics: computed.characteristics,
      recommendation_status: computed.recommendationStatus,
      near_target: hasAdjustment && computed.nearTarget ? targetContext(computed.nearTarget) : null,
      base_target: targetContext(computed.baseTarget),
      rebalancing_actions: computed.rebalancingActions.map((action) => ({
        asset_class: labelByKey[action.asset],
        delta_pp: action.delta,
        action: action.action,
      })),
      signals: computed.signals,
      strengths: computed.strengths,
      cautions: computed.cautions,
    },
  };
}
