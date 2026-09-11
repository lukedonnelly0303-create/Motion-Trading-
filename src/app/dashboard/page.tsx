import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, accounts, orders, kycDocuments, payoutRequests } from "@/db/schema";
import AccountCard from "@/components/AccountCard";
import KycPanel from "@/components/KycPanel";
import { formatUsd } from "@/lib/pricing";

// Always reflects the logged-in user's latest orders/accounts/payouts.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: {
      accounts: {
        orderBy: desc(accounts.createdAt),
        with: { payoutRequests: { orderBy: desc(payoutRequests.requestedAt) } },
      },
      orders: { orderBy: desc(orders.createdAt) },
      kycDocs: { orderBy: desc(kycDocuments.uploadedAt) },
    },
  });
  if (!user) redirect("/login");

  const pendingOrder = user.orders.find((o) => o.status === "PENDING");
  // Paid, but the account is being held back until KYC is verified (see
  // fulfillOrder in the Stripe webhook + provisionPendingAccountsForVerifiedUser).
  const accountOrderIds = new Set(user.accounts.map((a) => a.orderId));
  const awaitingKycOrder = user.orders.find((o) => o.status === "PAID" && !accountOrderIds.has(o.id));

  return (
    <main className="shell" style={{ padding: "44px 24px 90px" }}>
      <h1 style={{ fontSize: 26 }}>Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 6 }}>{user.email}</p>

      {pendingOrder && (
        <div className="card" style={{ marginTop: 20, borderColor: "rgba(199,134,47,0.35)", background: "var(--gold-soft)" }}>
          <p style={{ fontSize: 13.5 }}>
            You have a pending order for {formatUsd(pendingOrder.priceCents)} — it'll appear here as an account once payment
            completes.
          </p>
        </div>
      )}

      {awaitingKycOrder && (
        <div className="card" style={{ marginTop: 20, borderColor: "rgba(199,134,47,0.35)", background: "var(--gold-soft)" }}>
          <p style={{ fontSize: 13.5 }}>
            Payment received for {formatUsd(awaitingKycOrder.priceCents)} — your evaluation account will be created as soon
            as your identity verification below is approved.
          </p>
        </div>
      )}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 14 }}>Your accounts</h2>
        {user.accounts.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--ink-dim)" }}>No accounts yet.</p>
            <a href="/pricing" className="btn btn-primary" style={{ marginTop: 14 }}>
              Start a challenge
            </a>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {user.accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={{
                  id: account.id,
                  evaluationType: account.evaluationType,
                  phase: account.phase,
                  status: account.status,
                  accountSize: account.accountSize,
                  profitSplitPct: account.profitSplitPct,
                  providerLogin: account.providerLogin,
                  createdAt: account.createdAt.toISOString(),
                  latestPayout: account.payoutRequests[0]
                    ? { status: account.payoutRequests[0].status, amountCents: account.payoutRequests[0].amountCents }
                    : null,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 18, marginBottom: 14 }}>Identity verification</h2>
        <KycPanel kycStatus={user.kycStatus} docs={user.kycDocs.map((d) => ({ id: d.id, filename: d.filename, status: d.status }))} />
      </section>
    </main>
  );
}
