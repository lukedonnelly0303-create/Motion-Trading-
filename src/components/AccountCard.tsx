"use client";

import { useEffect, useState } from "react";
import { formatUsd } from "@/lib/pricing";

interface AccountMetrics {
  balance: number;
  equity: number;
  dailyDrawdownUsedPct: number;
  maxDrawdownUsedPct: number;
  profitTargetProgressPct: number;
  tradingDaysCompleted: number;
  status: "ACTIVE" | "PASSED" | "FAILED";
}

interface AccountProps {
  id: string;
  evaluationType: "ONE_STEP" | "TWO_STEP";
  phase: "PHASE_1" | "PHASE_2" | "FUNDED";
  status: "ACTIVE" | "PASSED" | "FAILED" | "FUNDED";
  accountSize: number;
  profitSplitPct: number;
  providerLogin: string | null;
  createdAt: string;
  latestPayout: { status: string; amountCents: number } | null;
}

export default function AccountCard({ account }: { account: AccountProps }) {
  const [metrics, setMetrics] = useState<AccountMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/accounts/${account.id}/metrics`);
      if (cancelled) return;
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Couldn't load metrics");
        return;
      }
      setMetrics(await res.json());
    }
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [account.id]);

  async function requestPayout() {
    setRequesting(true);
    setPayoutMsg(null);
    const res = await fetch("/api/payouts/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: account.id }),
    });
    const data = await res.json();
    setRequesting(false);
    setPayoutMsg(res.ok ? `Payout requested: ${formatUsd(data.amountCents)}` : data.error);
  }

  const statusBadge = {
    ACTIVE: { cls: "warn", label: "In progress" },
    PASSED: { cls: "ok", label: "Passed — awaiting funding" },
    FAILED: { cls: "bad", label: "Failed" },
    FUNDED: { cls: "ok", label: "Funded" },
  }[account.status];

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>
            {account.evaluationType === "ONE_STEP" ? "1-Step" : "2-Step"} · ${account.accountSize / 1000}K
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 4 }}>
            {account.providerLogin ?? "Provisioning…"} · opened {new Date(account.createdAt).toLocaleDateString()}
          </div>
        </div>
        <span className={`badge ${statusBadge.cls}`}>{statusBadge.label}</span>
      </div>

      {error && <p className="error-text" style={{ marginTop: 14 }}>{error}</p>}

      {metrics && (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16 }}>
          <Metric label="Equity" value={formatUsd(metrics.equity * 100)} />
          <Gauge label="Profit target" pct={Math.min(100, metrics.profitTargetProgressPct)} tone="accent" />
          <Gauge label="Daily drawdown used" pct={metrics.dailyDrawdownUsedPct} tone="danger" />
          <Gauge label="Max drawdown used" pct={metrics.maxDrawdownUsedPct} tone="danger" />
        </div>
      )}

      {account.status === "FUNDED" && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <button className="btn btn-primary" onClick={requestPayout} disabled={requesting}>
            {requesting ? "Requesting…" : "Request payout"}
          </button>
          {payoutMsg && <p className="hint" style={{ marginTop: 8 }}>{payoutMsg}</p>}
          {account.latestPayout && (
            <p className="hint" style={{ marginTop: 8 }}>
              Last request: {formatUsd(account.latestPayout.amountCents)} — {account.latestPayout.status.toLowerCase()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono" style={{ fontWeight: 700, fontSize: 17 }}>{value}</div>
      <div style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>{label}</div>
    </div>
  );
}

function Gauge({ label, pct, tone }: { label: string; pct: number; tone: "accent" | "danger" }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 6 }}>
        <span>{label}</span>
        <span className="mono">{pct.toFixed(0)}%</span>
      </div>
      <div className="bar-track">
        <div className={`bar-fill${tone === "danger" ? " danger" : ""}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
