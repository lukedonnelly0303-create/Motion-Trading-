/**
 * Trading-engine provider adapter.
 *
 * This is the ONE seam meant for a white-label prop-firm technology provider.
 * Everything else in this app (checkout, dashboard, payouts) is built against
 * this interface, not against any specific vendor — so swapping in a real
 * provider later means implementing `RemoteProvider` below and flipping
 * `PROVIDER_MODE`, not rewriting the app.
 *
 * See the "Trading engine integration" section of the original build prompt
 * (prop-firm-build-prompt.md) for why this can't be built from scratch here:
 * live MT5/cTrader connectivity, real-time rule enforcement, and market data
 * require a licensed liquidity/bridge relationship this app doesn't have.
 */

import { RULES, type EvaluationType } from "@/lib/pricing";

export interface ProvisionedAccount {
  providerAccountId: string;
  providerLogin: string;
}

export interface AccountMetrics {
  balance: number;
  equity: number;
  dailyDrawdownUsedPct: number; // 0-100, relative to the rule's daily limit
  maxDrawdownUsedPct: number; // 0-100, relative to the rule's overall limit
  profitTargetProgressPct: number; // 0-100+, relative to the current phase's target
  tradingDaysCompleted: number;
  status: "ACTIVE" | "PASSED" | "FAILED";
}

export interface TradingProvider {
  provisionAccount(input: {
    accountId: string;
    evaluationType: EvaluationType;
    accountSize: number;
  }): Promise<ProvisionedAccount>;

  getMetrics(input: {
    providerAccountId: string;
    accountId: string;
    evaluationType: EvaluationType;
    accountSize: number;
    createdAt: Date;
    phaseIndex?: number; // 0 = phase 1, 1 = phase 2 (two-step only)
  }): Promise<AccountMetrics>;

  resetAccount(input: { providerAccountId: string }): Promise<void>;
}

/**
 * Deterministic mock provider. No network calls, no real trading — it derives
 * a believable, gently-evolving equity curve from the account's own id and
 * age so the dashboard has something real to render before a live provider
 * is contracted. Replace with RemoteProvider (below) once you have one.
 */
class MockProvider implements TradingProvider {
  async provisionAccount({ accountId, accountSize }: { accountId: string; evaluationType: EvaluationType; accountSize: number }): Promise<ProvisionedAccount> {
    return {
      providerAccountId: `mock_${accountId}`,
      providerLogin: `MT-${hashToDigits(accountId, 8)}`,
    };
  }

  async getMetrics({ accountId, evaluationType, accountSize, createdAt, phaseIndex = 0 }: {
    providerAccountId: string;
    accountId: string;
    evaluationType: EvaluationType;
    accountSize: number;
    createdAt: Date;
    phaseIndex?: number;
  }): Promise<AccountMetrics> {
    const rules = RULES[evaluationType];
    const target = rules.profitTargetPct[phaseIndex] ?? rules.profitTargetPct[rules.profitTargetPct.length - 1];
    const daysElapsed = Math.max(0, (Date.now() - createdAt.getTime()) / 86_400_000);

    // Seeded pseudo-random walk so the same account always returns a
    // consistent, slowly-improving curve rather than random noise on every load.
    const seed = hashToInt(accountId);
    const wobble = seededSin(seed, daysElapsed);
    const progressPct = clamp(daysElapsed * 3.4 + wobble * 6, 0, target * 1.15);
    const balance = accountSize * (1 + progressPct / 100);
    const equity = balance * (1 + seededSin(seed + 1, daysElapsed) * 0.004);

    const dailyDDUsed = clamp(Math.abs(seededSin(seed + 2, daysElapsed)) * rules.dailyDrawdownPct * 0.5, 0, rules.dailyDrawdownPct);
    const maxDDUsed = clamp(Math.abs(seededSin(seed + 3, daysElapsed * 0.3)) * rules.maxDrawdownPct * 0.35, 0, rules.maxDrawdownPct);

    let status: AccountMetrics["status"] = "ACTIVE";
    if (progressPct >= target) status = "PASSED";
    if (maxDDUsed >= rules.maxDrawdownPct * 0.98) status = "FAILED";

    return {
      balance: round2(balance),
      equity: round2(equity),
      dailyDrawdownUsedPct: round2((dailyDDUsed / rules.dailyDrawdownPct) * 100),
      maxDrawdownUsedPct: round2((maxDDUsed / rules.maxDrawdownPct) * 100),
      profitTargetProgressPct: round2((progressPct / target) * 100),
      tradingDaysCompleted: Math.floor(daysElapsed),
      status,
    };
  }

  async resetAccount(): Promise<void> {
    // No-op for the mock — a real provider call would reset the remote balance.
    return;
  }
}

/**
 * Stub for a real white-label provider's REST API, matching the placeholder
 * contract from the marketing build prompt (POST /accounts, GET metrics,
 * POST reset). Fill in the fetch calls once you have a contract and API key,
 * then set PROVIDER_MODE=live below.
 */
class RemoteProvider implements TradingProvider {
  private baseUrl = process.env.PROVIDER_API_BASE_URL ?? "";
  private apiKey = process.env.PROVIDER_API_KEY ?? "";

  async provisionAccount(input: { accountId: string; evaluationType: EvaluationType; accountSize: number }): Promise<ProvisionedAccount> {
    const res = await fetch(`${this.baseUrl}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Provider provisionAccount failed: ${res.status}`);
    return res.json();
  }

  async getMetrics(input: { providerAccountId: string }): Promise<AccountMetrics> {
    const res = await fetch(`${this.baseUrl}/accounts/${input.providerAccountId}/metrics`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`Provider getMetrics failed: ${res.status}`);
    return res.json();
  }

  async resetAccount(input: { providerAccountId: string }): Promise<void> {
    const res = await fetch(`${this.baseUrl}/accounts/${input.providerAccountId}/reset`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`Provider resetAccount failed: ${res.status}`);
  }
}

// Set PROVIDER_MODE=live in .env once you've contracted a real white-label
// provider and filled in PROVIDER_API_BASE_URL / PROVIDER_API_KEY.
// Set PROVIDER_MODE=metaapi to use a single real MetaApi/MT4 demo account
// instead (see metaApiProvider.ts for what that does and doesn't cover).
// Anything else (including unset) keeps the app on the deterministic mock.
const PROVIDER_MODE: string = process.env.PROVIDER_MODE ?? "mock";

function buildProvider(): TradingProvider {
  if (PROVIDER_MODE === "live") return new RemoteProvider();
  if (PROVIDER_MODE === "metaapi") {
    // Lazy require so the metaapi.cloud-sdk dependency (and its network
    // calls) are only ever touched when this mode is actually selected.
    const { MetaApiProvider } = require("@/lib/metaApiProvider");
    return new MetaApiProvider();
  }
  return new MockProvider();
}

export const tradingProvider: TradingProvider = buildProvider();

// ---- small deterministic-math helpers, no dependency needed ----
function hashToInt(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
function hashToDigits(input: string, digits: number): string {
  return String(hashToInt(input)).padStart(digits, "0").slice(0, digits);
}
function seededSin(seed: number, t: number): number {
  return Math.sin(seed * 0.0001 + t * 0.9);
}
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
