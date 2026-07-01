# Mercury inbound-email Worker

Turns real forwarded applicant emails into POSTs to Mercury's ingest API. This is
the production transport behind the two email intake modes:

- **Manual forward** (try-it-now): the employer forwards applicant emails to
  `apply+<token>@<domain>`. The app's `resolveOriginalSender` digs the real
  candidate out of the forwarded block.
- **Auto-forward** (retention): a one-time Gmail/Outlook filter forwards the
  careers label automatically. The provider first emails a confirmation code to
  the address; the app captures it (`detectForwardVerification`) and surfaces it
  on the role so the employer can finish setup.

The Worker itself is deliberately dumb — it only parses MIME and forwards the
canonical JSON contract (see `src/lib/mercury/inbound.ts` in the app). All token
resolution, dedupe, and CV parsing live in the app, so this provider can be
swapped for Mailgun/SendGrid inbound parse without app changes.

## Deploy

```sh
npm install
npx wrangler secret put INBOUND_SECRET       # == the app's INBOUND_SECRET
npx wrangler secret put MERCURY_INGEST_URL    # https://<app>/api/mercury/inbound
npx wrangler deploy
```

Then in the Cloudflare dashboard: **Email Routing → enable on your apply domain →
add a catch-all rule → Send to a Worker → `mercury-email-worker`.**

Set `MERCURY_INBOUND_DOMAIN` in the app's env to the same apply domain so
`forwardingAddress()` prints the correct `apply+<token>@<domain>`.
