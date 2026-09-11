import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isKycVerified, provisionAccountForOrder } from "@/lib/provisioning";

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
 * Marks the order paid. If the trader's identity is already verified, this
 * also immediately provisions the evaluation account with the trading-engine
 * provider (mock today, a real white-label vendor once PROVIDER_MODE is
 * flipped in lib/propTechProvider.ts). If KYC isn't verified yet, the order
 * is left paid-but-unprovisioned — we don't hand out a trading account until
 * identity is confirmed. provisionPendingAccountsForVerifiedUser (called from
 * the admin KYC-approve action) picks up any orders left in that state once
 * verification completes. Idempotent — safe if Stripe retries the webhook.
 */
async function fulfillOrder(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status === "PAID") return;

  await db.update(orders).set({ status: "PAID", paidAt: new Date() }).where(eq(orders.id, orderId));

  if (await isKycVerified(order.userId)) {
    await provisionAccountForOrder(order);
  }
}
