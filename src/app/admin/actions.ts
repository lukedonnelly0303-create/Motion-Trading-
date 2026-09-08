"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { accounts, kycDocuments, payoutRequests, users } from "@/db/schema";
import { tradingProvider } from "@/lib/propTechProvider";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Admin only");
  }
  return session;
}

export async function approveKyc(docId: string) {
  await requireAdmin();
  const [doc] = await db.select().from(kycDocuments).where(eq(kycDocuments.id, docId)).limit(1);
  if (!doc) return;
  await db.update(kycDocuments).set({ status: "VERIFIED" }).where(eq(kycDocuments.id, docId));
  await db.update(users).set({ kycStatus: "VERIFIED" }).where(eq(users.id, doc.userId));
  revalidatePath("/admin");
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
    await db.update(accounts).set({ phase: "FUNDED", status: "FUNDED", fundedAt: new Date() }).where(eq(accounts.id, accountId));
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
  await db.update(payoutRequests).set({ status: "APPROVED" }).where(eq(payoutRequests.id, payoutId));
  revalidatePath("/admin");
}

export async function markPayoutPaid(payoutId: string) {
  await requireAdmin();
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
