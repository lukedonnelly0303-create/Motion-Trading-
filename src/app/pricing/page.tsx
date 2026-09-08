"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ACCOUNT_SIZES, RULES, priceFor, formatUsd, type EvaluationType } from "@/lib/pricing";

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [evaluationType, setEvaluationType] = useState<EvaluationType>("ONE_STEP");
  const [sizeIdx, setSizeIdx] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountSize = ACCOUNT_SIZES[sizeIdx];
  const priceCents = priceFor(evaluationType, accountSize);
  const rules = RULES[evaluationType];

  async function buy() {
    setError(null);
    if (!session?.user) {
      router.push(`/login?next=/pricing`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluationType, accountSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout failed");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Checkout failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="shell" style={{ padding: "60px 24px 90px" }}>
      <span className="badge">Choose your evaluation</span>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,36px)", marginTop: 12 }}>One challenge fee. Every rule, upfront.</h1>

      <div className="card" style={{ marginTop: 28, maxWidth: 640 }}>
        <div style={{ display: "inline-flex", background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 999, padding: 4 }}>
          {(["ONE_STEP", "TWO_STEP"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setEvaluationType(t)}
              className="btn"
              style={{
                background: evaluationType === t ? "var(--accent)" : "transparent",
                color: evaluationType === t ? "#03150e" : "var(--ink-dim)",
                padding: "8px 18px",
              }}
            >
              {t === "ONE_STEP" ? "1-Step" : "2-Step"}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 26 }}>
          <label htmlFor="size">Account size</label>
          <input id="size" type="range" min={0} max={ACCOUNT_SIZES.length - 1} step={1} value={sizeIdx} onChange={(e) => setSizeIdx(Number(e.target.value))} />
          <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8 }}>
            {ACCOUNT_SIZES.map((s) => (
              <span key={s}>${s / 1000}K</span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <span className="badge">Challenge fee</span>
            <div className="mono" style={{ fontFamily: "Archivo,sans-serif", fontWeight: 900, fontSize: 36, marginTop: 8 }}>
              {formatUsd(priceCents)}
            </div>
            <p style={{ color: "var(--accent)", fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>Refunded on your first payout</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", fontSize: 13 }}>
            <Stat label="Profit target" value={rules.profitTargetPct.join(" → ") + "%"} />
            <Stat label="Daily drawdown" value={rules.dailyDrawdownPct + "%"} />
            <Stat label="Max drawdown" value={rules.maxDrawdownPct + "%"} />
            <Stat label="Min. trading days" value={rules.minTradingDays ? String(rules.minTradingDays) + "/phase" : "None"} />
          </div>
        </div>

        {error && <p className="error-text" style={{ marginTop: 16 }}>{error}</p>}

        <button className="btn btn-primary" style={{ marginTop: 22, width: "100%" }} onClick={buy} disabled={loading}>
          {loading ? "Redirecting to checkout…" : `Start this challenge — ${formatUsd(priceCents)}`}
        </button>
        <p className="hint" style={{ marginTop: 10 }}>
          Runs Stripe in test mode until real keys are set in <span className="mono">.env</span>.
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono" style={{ fontWeight: 600 }}>{value}</div>
      <div style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>{label}</div>
    </div>
  );
}
