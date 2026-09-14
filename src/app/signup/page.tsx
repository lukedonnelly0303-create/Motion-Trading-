"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      const signInRes = await signIn("credentials", { email, password, redirect: false });
      if (signInRes?.error) {
        setError("Account created — please log in.");
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-panel">
        <span className="eyebrow">Motion Trading</span>
        <p className="auth-quote">
          "Pick a challenge, pass evaluation, get funded — up to 90% profit split on payout."
        </p>
        <div className="trust-strip">
          <span>Stripe checkout</span>
          <span>KYC verified</span>
          <span>Admin-reviewed</span>
        </div>
      </div>

      <div className="auth-form-side">
        <main className="shell" style={{ maxWidth: 440, padding: "0 24px" }}>
          <h1 style={{ fontSize: 26 }}>Create your account</h1>
          <p style={{ color: "var(--ink-dim)", marginTop: 8, fontSize: 14 }}>
            Already have one? <Link href="/login" style={{ color: "var(--accent)" }}>Log in</Link>
          </p>

          <form onSubmit={onSubmit} className="card" style={{ marginTop: 24, display: "grid", gap: 16 }}>
            <div>
              <label htmlFor="name">Full name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <p className="hint" style={{ marginTop: 6 }}>At least 8 characters.</p>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" disabled={loading} type="submit">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
