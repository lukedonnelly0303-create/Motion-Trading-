"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function NavBar() {
  const { data: session } = useSession();

  return (
    <header style={{ borderBottom: "1px solid var(--line)", position: "sticky", top: 0, background: "rgba(10,22,19,0.9)", backdropFilter: "blur(8px)", zIndex: 20 }}>
      <div className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px" }}>
        <Link href="/" className="brand">
          <span className="logo-mark">
            <svg viewBox="0 0 30 30" fill="none">
              <path d="M6 20 L12 13 L16 17 L24 8" stroke="#04160F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="brand-word">
            MOTION<span>·</span>TRADING
          </span>
        </Link>
        <nav style={{ display: "flex", gap: 18, alignItems: "center", fontSize: 14 }}>
          <Link href="/pricing" style={{ color: "var(--ink-dim)", textDecoration: "none" }}>
            Challenges
          </Link>
          {session?.user ? (
            <>
              <Link href="/dashboard" style={{ color: "var(--ink-dim)", textDecoration: "none" }}>
                Dashboard
              </Link>
              {session.user.role === "ADMIN" && (
                <Link href="/admin" style={{ color: "var(--ink-dim)", textDecoration: "none" }}>
                  Admin
                </Link>
              )}
              <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" style={{ color: "var(--ink-dim)", textDecoration: "none" }}>
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
