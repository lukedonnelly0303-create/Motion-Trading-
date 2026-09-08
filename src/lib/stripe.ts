import Stripe from "stripe";

// Lazily constructed so `next build` never fails just because a real Stripe
// key hasn't been set yet (e.g. in CI, or before you've created a Stripe
// account). Any route that actually calls Stripe will throw a clear error at
// request time instead if the key is missing — never at build time.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add a test-mode secret key from https://dashboard.stripe.com/test/apikeys to .env"
    );
  }
  _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return _stripe;
}
