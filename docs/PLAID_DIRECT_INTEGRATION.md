# Direct Plaid REST integration — setup guide

Today the intake form reads from the `Plaid_Transactions` Google Sheet cache
(refreshed every 2h by a Perplexity cron). This works but has ~2h staleness
and depends on the Perplexity Plaid connector.

Phase 2 replaces the cache with direct Plaid REST calls from Vercel. Live
data, no cache, no cron.

## What you need to do (one-time)

### 1. Open a Plaid developer account
- Go to https://dashboard.plaid.com/signup
- Sign up with your `riseabove@crestorg.com` email
- Choose "Personal / Development" for now (you can graduate to Production
  later)

### 2. Get to Production
- Plaid gives every account **Sandbox** (fake data) and **Development**
  (100 real Items free) immediately
- **Production** requires a business verification step: fill out the
  "Company Info" tab in the dashboard, enter Crestorg details, and submit.
  Approval typically takes 1-3 business days.
- For most yacht-ops uses, **Development** is enough (100 linked accounts is
  more than you need). No approval wait.

### 3. Copy the three keys from the dashboard
In the Plaid dashboard → **Team Settings** → **Keys**:
- `client_id` (same across all environments)
- `secret` for **Sandbox** (start here)
- `secret` for **Development** (use once you're ready to switch to real data)
- `secret` for **Production** (only after Company Info is approved)

### 4. Add to Vercel env vars
Vercel project → Settings → Environment Variables:
```
PLAID_CLIENT_ID       = <client_id>
PLAID_SECRET          = <sandbox or development or production secret>
PLAID_ENV             = sandbox | development | production
```

**Do NOT add access_tokens yet** — those come from step 5.

### 5. Run Plaid Link once per card
This is the OAuth-style flow that gives your app a permanent `access_token`
for each linked institution (Amex, Bilt).

Once Phase 2 code is deployed (see below), open
`https://sd118-runlog.vercel.app/admin/plaid-link` (admin-only page).
It will:
1. POST to `/api/plaid-link/create-link-token` → returns a link_token
2. Open Plaid Link modal → you log in to Amex, then Bilt
3. Plaid Link returns a `public_token`
4. POST to `/api/plaid-link/exchange-public-token` → exchanges for a
   permanent `access_token`
5. Display the token so you can paste it into Vercel env vars:
```
PLAID_ACCESS_TOKEN_AMEX = <access-token-1>
PLAID_ACCESS_TOKEN_BILT = <access-token-2>
```

After that, `/api/expense-plaid-match` will read `PLAID_ACCESS_TOKEN_*`,
call Plaid's `/transactions/get` endpoint live, and skip the Sheet cache
entirely.

## Files that will change

- `api/plaid-link/create-link-token.ts` — new
- `api/plaid-link/exchange-public-token.ts` — new
- `src/pages/admin/PlaidLink.tsx` — new admin page with Plaid Link SDK
- `api/expense-plaid-match.ts` — swap Sheet cache read for live Plaid call,
  keep the same request/response shape so intake needs no changes
- `api/expense-plaid-cache-refresh.ts` — can be deleted, along with the
  Perplexity cron `38dee3b4`

## Cost

Plaid pricing (as of 2026):
- Development: **free** (100 linked Items)
- Production: transactions endpoint ~$0.30/Item/month + $0.001 per API call
- Two cards × ~50 API calls/day × 30 days = ~$3/month per card = ~$6/month

## Rollback

If Phase 2 misbehaves, revert `expense-plaid-match.ts` to the Sheet-cache
version — the cache and cron are still there.

## When to do this

- **Now**: if you want live data and are comfortable opening a Plaid dev
  account today.
- **Later**: if the Phase 1 cross-card + duplicate checks (already deployed)
  solve today's problem, defer Phase 2 until you actually need the ~2h
  latency reduction.
