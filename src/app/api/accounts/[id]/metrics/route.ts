import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { tradingProvider } from "@/lib/propTechProvider";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [account] = await db.select().from(accounts).where(eq(accounts.id, params.id)).limit(1);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (account.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!account.providerAccountId) {
    return NextResponse.json({ error: "Account not yet provisioned" }, { status: 409 });
  }

  const metrics = await tradingProvider.getMetrics({
    providerAccountId: account.providerAccountId,
    accountId: account.id,
    evaluationType: account.evaluationType,
    accountSize: account.accountSize,
    createdAt: account.createdAt,
    phaseIndex: account.phase === "PHASE_2" ? 1 : 0,
  });

  // Auto-advance a PASSED evaluation account's status in our own records —
  // the provider is the source of truth for pass/fail, we just mirror it.
  if (metrics.status === "PASSED" && account.status === "ACTIVE") {
    await db.update(accounts).set({ status: "PASSED" }).where(eq(accounts.id, account.id));
  }
  if (metrics.status === "FAILED" && account.status === "ACTIVE") {
    await db.update(accounts).set({ status: "FAILED" }).where(eq(accounts.id, account.id));
  }

  return NextResponse.json(metrics);
}
