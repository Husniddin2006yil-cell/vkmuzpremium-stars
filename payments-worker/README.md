# Payments Worker

Cloudflare Worker for authenticating Telegram Mini App sessions, creating recurring Telegram Stars invoices, processing Bot API webhook updates, and storing payments/subscriptions in D1.

Run from this directory:

```bash
npm test
npx wrangler deploy --dry-run
npx wrangler deploy
```

The Worker uses the D1 binding `DB` configured in `wrangler.toml` and the secret `BOT_TOKEN`. Keep the bot token out of source control; set or rotate it with `npx wrangler secret put BOT_TOKEN`.

`GET /health?check=telegram` verifies D1, the token via `getMe`, and whether Telegram's current webhook URL matches this Worker. It does not change the webhook. `/setup` offers a guarded inspect-then-confirm flow if the webhook needs to be switched. Switching replaces the bot's prior webhook, so inspect it before confirming.

The `test/` suite mocks the Bot API and D1. No real Stars are charged by local tests.
