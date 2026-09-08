/**
 * Test-scale trading provider backed by a single real MetaApi/MT4 demo
 * account, instead of the deterministic mock in propTechProvider.ts.
 *
 * IMPORTANT SCOPE NOTE: this is deliberately a "does this feel real" test,
 * not a production integration. MetaApi is connected to exactly ONE demo
 * MT4 account (see METAAPI_ACCOUNT_ID below) — every trader's dashboard in
 * this mode reads from that SAME account, so balance/equity/trades will be
 * identical across every account using this provider. That's fine for
 * showing yourself (or a couple of test users) a real, live-priced trading
 * experience. It is NOT a per-customer setup: broker demo servers rate-limit
 * account creation, so provisioning a unique real account per signup needs
 * either a white-label prop-firm tech vendor (PropFirmsTech, FPFX Tech, etc.)
 * or a lot more plumbing than this file. See the "prop-firm-build-prompt.md"
 * research notes for the full picture.
 *
 * Set PROVIDER_MODE=metaapi and fill in METAAPI_TOKEN / METAAPI_ACCOUNT_ID /
 * METAAPI_BASELINE_BALANCE to use this instead of the mock.
 */

import MetaApi from "metaapi.cloud-sdk";
import { RULES, type EvaluationType } from "@/lib/pricing";
import type { AccountMetrics, ProvisionedAccount, TradingProvider } from "@/lib/propTechProvider";

const METAAPI_TOKEN = process.env.METAAPI_TOKEN ?? "";
const METAAPI_ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID ?? "";
// The demo account's starting balance (what you funded it with when you
// created it, e.g. 100000). Used purely to work out "% progress toward the
// profit target" from the account's live balance — MetaApi doesn't know
// what this app considers the challenge's starting point.
const BASELINE_BALANCE = Number(process.env.METAAPI_BASELINE_BALANCE ?? "100000");

let apiClient: MetaApi | null = null;
function getApiClient(): MetaApi {
  if (!METAAPI_TOKEN) {
    throw new Error("METAAPI_TOKEN is not set — cannot use the MetaApi trading provider.");
  }
  if (!apiClient) {
    apiClient = new MetaApi(METAAPI_TOKEN);
  }
  return apiClient;
}

/**
 * Opens a short-lived RPC connection to the MetaApi account, runs `fn` with
 * the live account information, and lets the connection close again.
 * A fresh connection per request is not how you'd want to do this at real
 * scale (each one takes a couple of seconds to synchronize) — for a handful
 * of test users hitting the dashboard occasionally, simplicity wins here.
 */
async function withAccountInformation<T>(
  fn: (info: { balance: number; equity: number }) => T
): Promise<T> {
  const api = getApiClient();
  const account = await api.metatraderAccountApi.getAccount(METAAPI_ACCOUNT_ID);
  await account.waitConnected();
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();
  const info = await connection.getAccountInformation();
  return fn({ balance: info.balance, equity: info.equity });
}

export class MetaApiProvider implements TradingProvider {
  async provisionAccount({ accountId }: { accountId: string; evaluationType: EvaluationType; accountSize: number }): Promise<ProvisionedAccount> {
    // Every account provisioned in this mode points at the same single demo
    // MT4 account — see the scope note at the top of this file.
    return {
      providerAccountId: METAAPI_ACCOUNT_ID,
      providerLogin: `MT4-${accountId.slice(0, 8)} (shared demo)`,
    };
  }

  async getMetrics({ evaluationType, createdAt, phaseIndex = 0 }: {
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

    const { balance, equity } = await withAccountInformation((info) => info);

    const gainPct = ((equity - BASELINE_BALANCE) / BASELINE_BALANCE) * 100;
    const progressPct = Math.max(0, gainPct);
    const lossPct = Math.max(0, -gainPct);

    // Real intraday/high-water-mark drawdown tracking needs trade-history
    // polling this simple version doesn't do yet — this approximates overall
    // drawdown from the live vs. baseline balance, which is good enough to
    // prove the numbers move for real, not a compliance-grade calculation.
    const maxDDUsedPct = Math.min(100, (lossPct / rules.maxDrawdownPct) * 100);
    const dailyDDUsedPct = Math.min(100, (lossPct / rules.dailyDrawdownPct) * 100);

    let status: AccountMetrics["status"] = "ACTIVE";
    if (progressPct >= target) status = "PASSED";
    if (lossPct >= rules.maxDrawdownPct * 0.98) status = "FAILED";

    return {
      balance: round2(balance),
      equity: round2(equity),
      dailyDrawdownUsedPct: round2(dailyDDUsedPct),
      maxDrawdownUsedPct: round2(maxDDUsedPct),
      profitTargetProgressPct: round2((progressPct / target) * 100),
      tradingDaysCompleted: Math.floor(daysElapsed),
      status,
    };
  }

  async resetAccount(): Promise<void> {
    // Resetting the shared demo account would affect every test user at
    // once, so this is intentionally a no-op in test-scale mode. A real
    // per-customer integration would reset that customer's own account here.
    return;
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
