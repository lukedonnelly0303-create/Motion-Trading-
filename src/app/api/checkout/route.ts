import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db, newId } from "@/db";
import { orders } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { isValidAccountSize, priceFor, type EvaluationType } from "@/lib/pricing";

const CheckoutSchema = z.object({
  evaluationType: z.enum(["ONE_STEP", "TWO_STEP"]),
  accountSize: z.number(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Log in first" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success || !isValidAccountSize(parsed.data.accountSize)) {
    return NextResponse.json({ error: "Invalid challenge selection" }, { status: 400 });
  }

  const { evaluationType, accountSize } = parsed.data as { evaluationType: EvaluationType; accountSize: 5000 | 10000 | 25000 | 50000 | 100000 | 200000 };
  const priceCents = priceFor(evaluationType, accountSize);

  const orderId = newId();
  await db.insert(orders).values({
    id: orderId,
    userId: session.user.id,
    evaluationType,
    accountSize,
    priceCents,
    status: "PENDING",
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  try {
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: session.user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            product_data: {
              name: `Motion Trading — ${evaluationType === "ONE_STEP" ? "1-Step" : "2-Step"} Challenge, $${accountSize / 1000}K`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
      metadata: { orderId },
    });

    await db.update(orders).set({ stripeSessionId: checkoutSession.id }).where(eq(orders.id, orderId));

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    // Common on a fresh checkout: no Stripe key configured yet. Fail loudly
    // rather than silently — this is exactly the kind of thing you want to
    // notice before a customer hits it.
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe is not configured yet — add STRIPE_SECRET_KEY to .env" },
      { status: 500 }
    );
  }
}
