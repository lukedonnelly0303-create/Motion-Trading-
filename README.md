# Motion Trading — commerce & account layer

The working app behind the [Motion Trading marketing site](../motion-trading.html):
signup/login, a challenge pricing page wired to real Stripe Checkout, a trader
dashboard with live account metrics, KYC upload, payout requests, and an admin
back office. Everything here is real, working infrastructure — the one
deliberate placeholder is the trading engine itself (see below).

## What's real vs. what's a placeholder

| Layer | Status |
|---|---|
| Auth (signup/login/sessions) | Real — NextAuth, bcrypt-hashed passwords |
| Database (users/orders/accounts/payouts/KYC) | Real — SQLite via libSQL, swappable for hosted Turso or any libSQL server |
| Checkout | Real Stripe Checkout integration — add your own test/live keys and it processes real payments |
| Admin back office | Real — approve KYC, fund accounts, approve/pay payouts |
| **Trading engine** (MT5/cTrader execution, live rule enforcement) | **Mocked.** See `src/lib/propTechProvider.ts` — a deterministic mock stands in until you contract a real white-label prop-firm tech provider. This is the one piece no app builder can produce; it needs a licensed liquidity/bridge relationship. |
| KYC document storage | Dev-only local disk (`/uploads`). Swap for S3 / Supabase Storage / R2 before deploying — most hosts don't give you a persistent filesystem. |

## Quick start

```bash
npm install
cp .env.example .env
# generate a session secret:
openssl rand -base64 32   # paste into NEXTAUTH_SECRET in .env

npm run db:push           # creates dev.db with the full schema
npm run dev                # http://localhost:3000
```

Sign up for an account, then promote yourself to admin so you can see the
back office:

```bash
npm run make-admin -- you@email.com
```

Log out and back in after that — the admin flag is embedded in your session
token, so it only takes effect on your next login.

## Testing the full order → funded → payout pipeline

Without a real Stripe key, checkout will fail at the "redirect to Stripe"
step (by design — it errors loudly rather than pretending to succeed). To
add real payments:

1. Create a free Stripe account, grab **test-mode** keys from
   https://dashboard.stripe.com/test/apikeys, and put them in `.env`.
2. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (via
   the [Stripe CLI](https://stripe.com/docs/stripe-cli)) so webhook events
   reach your local server, and copy the `whsec_...` it prints into
   `STRIPE_WEBHOOK_SECRET`.
3. Buy a challenge with a [Stripe test card](https://stripe.com/docs/testing)
   (`4242 4242 4242 4242`, any future date/CVC). The webhook fires,
   `fulfillOrder()` marks the order paid, and provisions an evaluation
   account through the mock trading provider.
4. Watch the dashboard — metrics poll every 15 seconds and the mock provider
   moves the account toward its profit target over a few (simulated) days.
5. Once it shows **Passed**, go to `/admin` and click **Fund account** (or
   **Start Phase 2** first, on a 2-Step challenge).
6. Back on the dashboard, **Request payout** becomes available, computed as
   `(equity − starting balance) × profit split %`.
7. In `/admin`, **Approve** then **Mark paid** the payout request.

## Plugging in a real trading-engine provider

Everything the app needs from a trading engine goes through one interface —
`TradingProvider` in `src/lib/propTechProvider.ts`:

- `provisionAccount()` — create the evaluation account, return login credentials
- `getMetrics()` — current balance/equity, drawdown used, profit-target progress
- `resetAccount()` — reset a failed evaluation

Once you've contracted a white-label prop-firm tech provider (see the
`prop-firm-build-prompt.md` doc for how to evaluate one — typical setup is
$5k–$50k plus $3k–$25k+/month), implement `RemoteProvider`'s three fetch
calls against their real API, set `PROVIDER_MODE=live` and
`PROVIDER_API_BASE_URL` / `PROVIDER_API_KEY` in `.env`, and nothing else in
the app changes — the dashboard, admin panel, and payout math all already
read through this same interface.

## Deploying

- **App**: any Node host that supports Next.js 14 (Vercel is the path of
  least resistance for the App Router + Server Actions used here).
- **Database**: swap `DATABASE_URL` for a hosted [Turso](https://turso.tech)
  database (`libsql://your-db.turso.io` + `DATABASE_AUTH_TOKEN`) — same
  SQLite dialect, no code changes. For a traditional Postgres setup instead,
  swap the `sqlite-core` imports in `src/db/schema.ts` for `pg-core` and the
  `libsql` driver in `src/db/index.ts` for `node-postgres`; Drizzle's API
  stays the same either way.
- **File storage**: replace the local-disk KYC upload in
  `src/app/api/kyc/upload/route.ts` with S3/R2/Supabase Storage — most hosts
  (Vercel included) don't persist local files between requests.
- **Stripe webhook**: point Stripe's dashboard webhook config at
  `https://yourdomain.com/api/webhooks/stripe` for the `checkout.session.completed` event.
- Run `npm audit` before going live — this starter pins reasonably current
  versions but a few transitive dev-tooling dependencies (Next's own
  PostCSS/esbuild chain) will drift over time.

## Project layout

```
src/
  db/               Drizzle schema + client (src/db/schema.ts, src/db/index.ts)
  lib/
    auth.ts           NextAuth config (credentials provider)
    pricing.ts         Shared pricing/rules data — single source of truth
    propTechProvider.ts  The trading-engine adapter (mock + real-provider stub)
    stripe.ts           Lazily-constructed Stripe client
  app/
    pricing/            Challenge builder + checkout
    dashboard/           Trader-facing account list, KYC, payouts
    admin/               Back office (KYC/account/payout approvals)
    api/                 Route handlers (signup, checkout, webhooks, metrics, payouts, KYC)
scripts/
  make-admin.ts        Promote a user to ADMIN from the command line
```
