export type WealthPlannerState = {
  currentAssets: number;
  monthlyContribution: number;
  annualRate: number;
  years: number;
  goalAmount: number;
  salary: number;
  otherIncome: number;
  fixedExpense: number;
  variableExpense: number;
  monthlySavings: number;
  monthlyInvestment: number;
};

export type ProjectionPoint = {
  year: number;
  principal: number;
  total: number;
};

export type WealthProjection = {
  principal: number;
  total: number;
  profit: number;
  returnRate: number;
  goalMonths: number | null;
  plusContributionTotal: number;
  series: ProjectionPoint[];
};

export const DEFAULT_WEALTH_PLANNER: WealthPlannerState = {
  currentAssets: 10_000_000,
  monthlyContribution: 300_000,
  annualRate: 5,
  years: 10,
  goalAmount: 100_000_000,
  salary: 0,
  otherIncome: 0,
  fixedExpense: 0,
  variableExpense: 0,
  monthlySavings: 0,
  monthlyInvestment: 0,
};

function finite(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegative(value: unknown, fallback = 0) {
  return Math.max(0, finite(value, fallback));
}

export function normalizeWealthPlanner(value: unknown): WealthPlannerState {
  const input = value && typeof value === "object" ? value as Partial<WealthPlannerState> : {};
  return {
    currentAssets: nonNegative(input.currentAssets, DEFAULT_WEALTH_PLANNER.currentAssets),
    monthlyContribution: nonNegative(input.monthlyContribution, DEFAULT_WEALTH_PLANNER.monthlyContribution),
    annualRate: Math.min(30, Math.max(-30, finite(input.annualRate, DEFAULT_WEALTH_PLANNER.annualRate))),
    years: Math.min(40, Math.max(1, Math.round(finite(input.years, DEFAULT_WEALTH_PLANNER.years)))),
    goalAmount: nonNegative(input.goalAmount, DEFAULT_WEALTH_PLANNER.goalAmount),
    salary: nonNegative(input.salary),
    otherIncome: nonNegative(input.otherIncome),
    fixedExpense: nonNegative(input.fixedExpense),
    variableExpense: nonNegative(input.variableExpense),
    monthlySavings: nonNegative(input.monthlySavings),
    monthlyInvestment: nonNegative(input.monthlyInvestment),
  };
}

export function futureValue(currentAssets: number, monthlyContribution: number, annualRate: number, months: number) {
  const principal = nonNegative(currentAssets);
  const contribution = nonNegative(monthlyContribution);
  const safeMonths = Math.max(0, Math.round(finite(months)));
  const monthlyRate = Math.min(30, Math.max(-30, finite(annualRate))) / 100 / 12;

  if (safeMonths === 0) return principal;
  if (Math.abs(monthlyRate) < 1e-12) return principal + contribution * safeMonths;

  const growth = Math.pow(1 + monthlyRate, safeMonths);
  return Math.max(0, principal * growth + contribution * ((growth - 1) / monthlyRate));
}

export function monthsToGoal(currentAssets: number, monthlyContribution: number, annualRate: number, goalAmount: number) {
  const goal = nonNegative(goalAmount);
  if (nonNegative(currentAssets) >= goal) return 0;
  if (goal === 0 || (nonNegative(currentAssets) === 0 && nonNegative(monthlyContribution) === 0)) return null;

  for (let month = 1; month <= 40 * 12; month += 1) {
    if (futureValue(currentAssets, monthlyContribution, annualRate, month) >= goal) return month;
  }
  return null;
}

export function projectWealth(state: WealthPlannerState): WealthProjection {
  const normalized = normalizeWealthPlanner(state);
  const months = normalized.years * 12;
  const total = futureValue(normalized.currentAssets, normalized.monthlyContribution, normalized.annualRate, months);
  const principal = normalized.currentAssets + normalized.monthlyContribution * months;
  const profit = total - principal;
  const returnRate = principal > 0 ? profit / principal * 100 : 0;
  const series = Array.from({ length: normalized.years + 1 }, (_, year) => ({
    year,
    principal: normalized.currentAssets + normalized.monthlyContribution * year * 12,
    total: futureValue(normalized.currentAssets, normalized.monthlyContribution, normalized.annualRate, year * 12),
  }));

  return {
    principal,
    total,
    profit,
    returnRate,
    goalMonths: monthsToGoal(normalized.currentAssets, normalized.monthlyContribution, normalized.annualRate, normalized.goalAmount),
    plusContributionTotal: futureValue(normalized.currentAssets, normalized.monthlyContribution + 100_000, normalized.annualRate, months),
    series,
  };
}

export function summarizeMonthlyFlow(state: WealthPlannerState) {
  const normalized = normalizeWealthPlanner(state);
  const income = normalized.salary + normalized.otherIncome;
  const spending = normalized.fixedExpense + normalized.variableExpense;
  const buildingAssets = normalized.monthlySavings + normalized.monthlyInvestment;
  const remainder = income - spending - buildingAssets;
  return {
    income,
    spending,
    buildingAssets,
    remainder,
    assetRate: income > 0 ? buildingAssets / income * 100 : 0,
  };
}
