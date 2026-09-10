import { desc, inArray, eq } from "drizzle-orm";
import { db } from "@/db";

// This page reads live back-office data (pending KYC, payouts, accounts) on
// every load — it must never be statically cached at build time.
export const dynamic = "force-dynamic";
import { users, accounts, payoutRequests, kycDocuments } from "@/db/schema";
import { formatUsd } from "@/lib/pricing";
import {
  approveKyc,
  rejectKyc,
  advanceAccount,
  markAccountFailed,
  resetAccount,
  approvePayout,
  markPayoutPaid,
  rejectPayout,
} from "./actions";

export default async function AdminPage() {
  const [userList, accountList, payoutList, kycList] = await Promise.all([
    db.query.users.findMany({ orderBy: desc(users.createdAt), limit: 50 }),
    db.query.accounts.findMany({ orderBy: desc(accounts.createdAt), limit: 50, with: { user: true } }),
    db.query.payoutRequests.findMany({
      where: inArray(payoutRequests.status, ["PENDING", "APPROVED"]),
      orderBy: desc(payoutRequests.requestedAt),
      with: { account: { with: { user: true } } },
    }),
    db.query.kycDocuments.findMany({
      where: eq(kycDocuments.status, "PENDING"),
      orderBy: desc(kycDocuments.uploadedAt),
      with: { user: true },
    }),
  ]);

  return (
    <main className="shell" style={{ padding: "44px 24px 90px" }}>
      <span className="badge">Back office</span>
      <h1 style={{ fontSize: 26, marginTop: 12 }}>Admin</h1>

      <Section title={`Pending KYC (${kycList.length})`}>
        {kycList.length === 0 ? (
          <Empty text="Nothing waiting on review." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>File</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {kycList.map((d) => (
                <tr key={d.id}>
                  <td>{d.user.email}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {d.blobPath ? (
                      <a href={`/api/admin/kyc/${d.id}/file`} target="_blank" rel="noreferrer">
                        {d.filename}
                      </a>
                    ) : (
                      d.filename
                    )}
                  </td>
                  <td>{d.uploadedAt.toLocaleDateString()}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <form action={approveKyc.bind(null, d.id)}>
                      <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>Approve</button>
                    </form>
                    <form action={rejectKyc.bind(null, d.id)}>
                      <button className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }}>Reject</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Payout requests (${payoutList.length})`}>
        {payoutList.length === 0 ? (
          <Empty text="No pending payout requests." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Trader</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payoutList.map((p) => (
                <tr key={p.id}>
                  <td>{p.account.user.email}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{p.account.providerLogin}</td>
                  <td className="mono">{formatUsd(p.amountCents)}</td>
                  <td><span className="badge warn">{p.status}</span></td>
                  <td style={{ display: "flex", gap: 8 }}>
                    {p.status === "PENDING" && (
                      <form action={approvePayout.bind(null, p.id)}>
                        <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>Approve</button>
                      </form>
                    )}
                    {p.status === "APPROVED" && (
                      <form action={markPayoutPaid.bind(null, p.id)}>
                        <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>Mark paid</button>
                      </form>
                    )}
                    <form action={rejectPayout.bind(null, p.id)}>
                      <button className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }}>Reject</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Accounts (${accountList.length})`}>
        <table>
          <thead>
            <tr>
              <th>Trader</th>
              <th>Type</th>
              <th>Phase</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accountList.map((a) => (
              <tr key={a.id}>
                <td>{a.user.email}</td>
                <td className="mono" style={{ fontSize: 12 }}>{a.evaluationType} · ${a.accountSize / 1000}K</td>
                <td>{a.phase}</td>
                <td>
                  <span
                    className={`badge ${a.status === "FUNDED" || a.status === "PASSED" ? "ok" : a.status === "FAILED" ? "bad" : "warn"}`}
                  >
                    {a.status}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {a.status === "PASSED" && (
                    <form action={advanceAccount.bind(null, a.id)}>
                      <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>
                        {a.evaluationType === "TWO_STEP" && a.phase === "PHASE_1" ? "Start Phase 2" : "Fund account"}
                      </button>
                    </form>
                  )}
                  {a.status !== "FAILED" && (
                    <form action={markAccountFailed.bind(null, a.id)}>
                      <button className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }}>Mark failed</button>
                    </form>
                  )}
                  <form action={resetAccount.bind(null, a.id)}>
                    <button className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }}>Reset</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={`Users (${userList.length})`}>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>KYC</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {userList.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <span className={`badge ${u.kycStatus === "VERIFIED" ? "ok" : u.kycStatus === "REJECTED" ? "bad" : u.kycStatus === "PENDING" ? "warn" : ""}`}>
                    {u.kycStatus}
                  </span>
                </td>
                <td>{u.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        {children}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: "var(--ink-dim)", fontSize: 14 }}>{text}</p>;
}
