import { eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { accounts, orders, users } from "@/db/schema";
import { tradingProvider } from "@/lib/propTechProvider";

type OrderRow = typeof orders.$inferSelect;

/**
 * Creates the evaluation account for a paid order and provisions it with the
 * trading-engine provider. This is the one place account rows get created —
 * called either right after payment (if the trader's identity is already
 * verified) or later, once an admin approves their KYC (see approveKyc in
 * src/app/admin/actions.ts). Idempotent-ish: callers are expected to only
 * invoke this for an order that doesn't already have an account (checked via
 * accountExistsForOrder below).
 */
export async function provisionAccountForOrder(order: OrderRow) {
  const accountId = newId();
  await db.insert(accounts).values({
    id: accountId,
    userId: order.userId,
    orderId: order.id,
    evaluationType: order.evaluationType,
    accountSize: order.accountSize,
    phase: "PHASE_1",
    status: "ACTIVE",
    profitSplitPct: 80,
  });

  const provisioned = await tradingProvider.provisionAccount({
    accountId,
    evaluationType: order.evaluationType,
    accountSize: order.accountSize,
  });

  await db
    .update(accounts)
    .set({ providerAccountId: provisioned.providerAccountId, providerLogin: provisioned.providerLogin })
    .where(eq(accounts.id, accountId));

  return accountId;
}

async function accountExistsForOrder(orderId: string) {
  const [existing] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.orderId, orderId)).limit(1);
  return !!existing;
}

/**
 * Provisions accounts for every paid order a user has that's still waiting
 * on one — i.e. orders paid before their KYC was verified. Call this right
 * after a trader's KYC status flips to VERIFIED so payment they've already
 * made doesn't get stuck waiting on a second trigger.
 */
export async function provisionPendingAccountsForVerifiedUser(userId: string) {
  const paidOrders = await db.select().from(orders).where(eq(orders.userId, userId));
  const created: string[] = [];
  for (const order of paidOrders) {
    if (order.status !== "PAID") continue;
    if (await accountExistsForOrder(order.id)) continue;
    created.push(await provisionAccountForOrder(order));
  }
  return created;
}

/** True if this user is allowed to have an evaluation account provisioned
 * immediately on payment, rather than waiting for KYC approval. */
export async function isKycVerified(userId: string) {
  const [user] = await db.select({ kycStatus: users.kycStatus }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.kycStatus === "VERIFIED";
}
