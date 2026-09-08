// Single source of truth for challenge pricing & rules — shared by the
// pricing page, the checkout API route, and the mock trading-provider adapter.
// Mirrors the numbers used on the published marketing site so the two stay
// consistent; tune freely, nothing else needs to change to match.

export type EvaluationType = "ONE_STEP" | "TWO_STEP";

export const ACCOUNT_SIZES = [5000, 10000, 25000, 50000, 100000, 200000] as const;
export type AccountSize = (typeof ACCOUNT_SIZES)[number];

export const PRICING_CENTS: Record<EvaluationType, Record<AccountSize, number>> = {
  ONE_STEP: {
    5000: 3900,
    10000: 6900,
    25000: 14900,
    50000: 25900,
    100000: 43900,
    200000: 85900,
  },
  TWO_STEP: {
    5000: 2900,
    10000: 4900,
    25000: 10900,
    50000: 18900,
    100000: 32900,
    200000: 64900,
  },
};

export interface RuleSet {
  profitTargetPct: number[]; // one entry per phase
  dailyDrawdownPct: number;
  maxDrawdownPct: number;
  minTradingDays: number; // per phase; 0 = none
}

export const RULES: Record<EvaluationType, RuleSet> = {
  ONE_STEP: { profitTargetPct: [10], dailyDrawdownPct: 4, maxDrawdownPct: 8, minTradingDays: 0 },
  TWO_STEP: { profitTargetPct: [8, 5], dailyDrawdownPct: 5, maxDrawdownPct: 10, minTradingDays: 4 },
};

export const BASE_PROFIT_SPLIT_PCT = 80;
export const EVALUATION_PROFIT_SHARE_PCT = 15; // trader keeps this % of profit made during the evaluation itself

export function priceFor(evaluationType: EvaluationType, size: AccountSize): number {
  return PRICING_CENTS[evaluationType][size];
}

export function isValidAccountSize(size: number): size is AccountSize {
  return (ACCOUNT_SIZES as readonly number[]).includes(size);
}

export function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
