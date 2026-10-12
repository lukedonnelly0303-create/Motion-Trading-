"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { accounts, kycDocuments, payoutRequests, users } from "@/db/schema";
import { tradingProvider } from "@/lib/propTechProvider";
import { provisionPendingAccountsForVerifiedUser } from "@/lib/provisioning";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Admin only");
  }
  return session;
}

/** Payouts can only be approved or paid to traders whose KYC is verified. */
async function requirePayoutOwnerKycVerified(payoutId: string) {
  const payout = await db.query.payoutRequests.findFirst({
    where: eq(payoutRequests.id, payoutId),
    with: { account: { with: { user: true } } },
  });
  if (!payout) throw new Error("Payout not found");
  if (payout.account.user.kycStatus !== "VERIFIED") {
    throw new Error("Trader's identity is not verified");
  }
}

export async function approveKyc(docId: string) {
  await requireAdmin();
  const [doc] = await db.select().from(kycDocuments).where(eq(kycDocuments.id, docId)).limit(1);
  if (!doc) return;
  await db.update(kycDocuments).set({ status: "VERIFIED" }).where(eq(kycDocuments.id, docId));
  await db.update(users).set({ kycStatus: "VERIFIED" }).where(eq(users.id, doc.userId));
  // A trader can pay before their identity is verified — we hold their
  // account back until then (see fulfillOrder in the Stripe webhook). Now
  // that they're verified, provision an account for any order that was left
  // waiting on this.
  await provisionPendingAccountsForVerifiedUser(doc.userId);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function rejectKyc(docId: string) {
  await requireAdmin();
  const [doc] = await db.select().from(kycDocuments).where(eq(kycDocuments.id, docId)).limit(1);
  if (!doc) return;
  await db.update(kycDocuments).set({ status: "REJECTED" }).where(eq(kycDocuments.id, docId));
  await db.update(users).set({ kycStatus: "REJECTED" }).where(eq(users.id, doc.userId));
  revalidatePath("/admin");
}

/** Moves a PASSED account to the next phase, or to FUNDED if there is none. */
export async function advanceAccount(accountId: string) {
  await requireAdmin();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account || account.status !== "PASSED") return;

  if (account.evaluationType === "TWO_STEP" && account.phase === "PHASE_1") {
    await db.update(accounts).set({ phase: "PHASE_2", status: "ACTIVE" }).where(eq(accounts.id, accountId));
  } else {
    // A funded account is a fresh account: new login from the provider,
    // full starting balance, and metrics measured from today (see
    // metricsStartDate), so evaluation profit can't be paid out.
    const provisioned = await tradingProvider.provisionAccount({
      accountId,
      evaluationType: account.evaluationType,
      accountSize: account.accountSize,
      stage: "FUNDED",
    });
    await db
      .update(accounts)
      .set({
        phase: "FUNDED",
        status: "FUNDED",
        fundedAt: new Date(),
        providerAccountId: provisioned.providerAccountId,
        providerLogin: provisioned.providerLogin,
      })
      .where(eq(accounts.id, accountId));
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function markAccountFailed(accountId: string) {
  await requireAdmin();
  await db.update(accounts).set({ status: "FAILED" }).where(eq(accounts.id, accountId));
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function resetAccount(accountId: string) {
  await requireAdmin();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account) return;
  if (account.providerAccountId) {
    await tradingProvider.resetAccount({ providerAccountId: account.providerAccountId });
  }
  await db.update(accounts).set({ status: "ACTIVE", phase: "PHASE_1" }).where(eq(accounts.id, accountId));
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function approvePayout(payoutId: string) {
  await requireAdmin();
  await requirePayoutOwnerKycVerified(payoutId);
  await db.update(payoutRequests).set({ status: "APPROVED" }).where(eq(payoutRequests.id, payoutId));
  revalidatePath("/admin");
}

export async function markPayoutPaid(payoutId: string) {
  await requireAdmin();
  await requirePayoutOwnerKycVerified(payoutId);
  await db.update(payoutRequests).set({ status: "PAID", processedAt: new Date() }).where(eq(payoutRequests.id, payoutId));
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function rejectPayout(payoutId: string) {
  await requireAdmin();
  await db.update(payoutRequests).set({ status: "REJECTED", processedAt: new Date() }).where(eq(payoutRequests.id, payoutId));
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
