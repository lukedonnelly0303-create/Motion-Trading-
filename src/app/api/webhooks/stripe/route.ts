import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { db, newId } from "@/db";
import { orders, accounts } from "@/db/schema";
import { tradingProvider } from "@/lib/propTechProvider";

// Stripe needs the raw request body to verify the webhook signature.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const orderId = checkoutSession.metadata?.orderId;
    if (orderId) {
      await fulfillOrder(orderId);
    }
  }

  return NextResponse.json({ received: true });
}

/**
 * Marks the order paid and provisions the evaluation account with the
 * trading-engine provider (mock today, a real white-label vendor once
 * PROVIDER_MODE is flipped in lib/propTechProvider.ts). Idempotent — safe if
 * Stripe retries the webhook.
 */
async function fulfillOrder(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status === "PAID") return;

  await db.update(orders).set({ status: "PAID", paidAt: new Date() }).where(eq(orders.id, orderId));

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
}
