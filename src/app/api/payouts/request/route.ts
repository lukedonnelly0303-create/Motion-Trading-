import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db, newId } from "@/db";
import { accounts, payoutRequests } from "@/db/schema";
import { tradingProvider } from "@/lib/propTechProvider";

const Schema = z.object({ accountId: z.string() });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const [account] = await db.select().from(accounts).where(eq(accounts.id, parsed.data.accountId)).limit(1);
  if (!account || account.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (account.status !== "FUNDED" || !account.providerAccountId) {
    return NextResponse.json({ error: "Only funded accounts can request a payout" }, { status: 409 });
  }

  const metrics = await tradingProvider.getMetrics({
    providerAccountId: account.providerAccountId,
    accountId: account.id,
    evaluationType: account.evaluationType,
    accountSize: account.accountSize,
    createdAt: account.createdAt,
  });

  const profitCents = Math.max(0, Math.round((metrics.equity - account.accountSize) * 100));
  const eligibleCents = Math.round((profitCents * account.profitSplitPct) / 100);

  if (eligibleCents <= 0) {
    return NextResponse.json({ error: "No eligible profit to pay out yet" }, { status: 409 });
  }

  const [pending] = await db
    .select()
    .from(payoutRequests)
    .where(and(eq(payoutRequests.accountId, account.id), eq(payoutRequests.status, "PENDING")))
    .limit(1);
  if (pending) {
    return NextResponse.json({ error: "A payout request is already pending on this account" }, { status: 409 });
  }

  const id = newId();
  await db.insert(payoutRequests).values({ id, accountId: account.id, amountCents: eligibleCents, status: "PENDING" });

  return NextResponse.json({ id, amountCents: eligibleCents, status: "PENDING" });
}
