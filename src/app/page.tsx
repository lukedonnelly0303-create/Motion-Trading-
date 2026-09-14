import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="shell" style={{ padding: "72px 24px 40px" }}>
        <div className="hero-grid">
          <div>
            <span className="eyebrow">Commerce &amp; account layer</span>
            <h1 style={{ fontSize: "clamp(30px,4.2vw,46px)", marginTop: 16, maxWidth: "17ch", lineHeight: 1.08 }}>
              The app behind the Motion Trading site.
            </h1>
            <p style={{ color: "var(--ink-dim)", marginTop: 16, maxWidth: "52ch", fontSize: 16 }}>
              Sign up, buy a challenge, and watch a real account move through the pipeline — order → payment →
              provisioning → dashboard → payout. The trading engine behind it is a swappable mock until a real
              white-label provider is contracted; everything else here is real, working infrastructure.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <Link href="/pricing" className="btn btn-primary">
                Browse challenges →
              </Link>
              <Link href="/signup" className="btn btn-ghost">
                Create an account
              </Link>
            </div>

            <div className="stat-rail">
              <div className="stat-item">
                <div className="stat-value">2</div>
                <div className="stat-label">Evaluation types</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">90%</div>
                <div className="stat-label">Max profit split</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">5</div>
                <div className="stat-label">Account sizes</div>
              </div>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-card-head">
              <span className="badge">Demo account · #48213</span>
              <span className="live-dot">Live</span>
            </div>
            <svg viewBox="0 0 320 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(23,165,106,0.35)" />
                  <stop offset="100%" stopColor="rgba(23,165,106,0)" />
                </linearGradient>
              </defs>
              <path
                d="M0,92 L27,86 L54,90 L81,70 L108,74 L135,54 L162,60 L189,42 L216,48 L243,26 L270,32 L297,14 L320,18 L320,120 L0,120 Z"
                fill="url(#sparkFill)"
              />
              <path
                d="M0,92 L27,86 L54,90 L81,70 L108,74 L135,54 L162,60 L189,42 L216,48 L243,26 L270,32 L297,14 L320,18"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="chart-card-foot">
              <div>
                <div className="mono" style={{ fontSize: 12, color: "var(--ink-faint)" }}>Equity</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>$104,820.00</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 12, color: "var(--ink-faint)" }}>Today</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>+4.82%</div>
              </div>
            </div>
          </div>
        </div>

        <div className="trust-strip" style={{ marginTop: 56 }}>
          <span>Stripe checkout</span>
          <span>KYC verified payouts</span>
          <span>Drizzle + Turso ledger</span>
          <span>Admin-reviewed funding</span>
        </div>
      </section>

      <section className="shell" style={{ padding: "48px 24px 90px" }}>
        <span className="eyebrow">How it works</span>
        <h2 style={{ fontSize: "clamp(22px,2.6vw,30px)", marginTop: 12, marginBottom: 24 }}>
          Three steps from checkout to a funded dashboard.
        </h2>
        <div className="feature-grid">
          <div className="card">
            <span className="feature-num">1</span>
            <h3 style={{ fontSize: 16 }}>Choose &amp; pay</h3>
            <p style={{ color: "var(--ink-dim)", fontSize: 13.5 }}>
              Pick a 1-step or 2-step evaluation and an account size, then check out with Stripe.
            </p>
          </div>
          <div className="card">
            <span className="feature-num">2</span>
            <h3 style={{ fontSize: 16 }}>Verify &amp; provision</h3>
            <p style={{ color: "var(--ink-dim)", fontSize: 13.5 }}>
              Upload ID for KYC — once approved, your evaluation account is provisioned automatically.
            </p>
          </div>
          <div className="card">
            <span className="feature-num">3</span>
            <h3 style={{ fontSize: 16 }}>Trade &amp; get paid</h3>
            <p style={{ color: "var(--ink-dim)", fontSize: 13.5 }}>
              Track phase progress on your dashboard and request a payout once you hit target.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
