"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Incorrect email or password");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="shell" style={{ maxWidth: 420, padding: "70px 24px" }}>
      <h1 style={{ fontSize: 26 }}>Log in</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 8, fontSize: 14 }}>
        Need an account? <Link href="/signup" style={{ color: "var(--accent)" }}>Sign up</Link>
      </p>

      <form onSubmit={onSubmit} className="card" style={{ marginTop: 24, display: "grid", gap: 16 }}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
