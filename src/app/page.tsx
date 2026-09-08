import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell" style={{ padding: "90px 24px" }}>
      <span className="badge">Commerce & account layer</span>
      <h1 style={{ fontSize: "clamp(28px,4vw,42px)", marginTop: 14, maxWidth: "18ch" }}>
        The app behind the Motion Trading site.
      </h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 14, maxWidth: "56ch", fontSize: 16 }}>
        Sign up, buy a challenge, and watch a real account move through the pipeline — order → payment →
        provisioning → dashboard → payout. The trading engine behind it is a swappable mock until you
        contract a real white-label provider; everything else here is real, working infrastructure.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
        <Link href="/pricing" className="btn btn-primary">
          Browse challenges →
        </Link>
        <Link href="/signup" className="btn btn-ghost">
          Create an account
        </Link>
      </div>
    </main>
  );
}
