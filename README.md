# Odyssey IMAX 70mm Ticket Watcher

Watches Cineplex for **new IMAX 70mm dates of "The Odyssey" at Cinéma Banque Scotia Montréal**
(977 Ste-Catherine O) appearing **after 2026-09-16**, and pushes an urgent notification to your
iPhone the moment one goes on sale. It **never buys tickets** — you tap the notification and buy
manually.

How it works: Cineplex's own website loads its showtimes from a public JSON API
(`apis.cineplex.com`). The watcher politely asks that same API "which dates are bookable?"
(1 tiny request per check). Only when a date later than the baseline appears does it fetch that
date's showtimes to confirm real **IMAX + 70mm** sessions (plain 70mm, plain IMAX, Regular,
UltraAVX and VIP are all ignored). It respects rate limits, sends an honest User-Agent, and does
not touch checkout, CAPTCHAs, or anti-bot systems.

---

## 1. Prerequisites

- **Node.js 20+** — check with `node --version`. If missing, install from https://nodejs.org.
- Then, in this folder: `npm install`

## 2. Install ntfy on your iPhone

1. Open the **App Store**, search **"ntfy"** (grey/green logo, by *ntfy LLC / Philipp Heckel*).
2. Install it (free) and open it once.

## 3. Allow notifications & subscribe to your private topic

1. When ntfy first opens it asks *"ntfy Would Like to Send You Notifications"* → tap **Allow**.
   (Missed it? iPhone **Settings → Apps → ntfy → Notifications → Allow**, and enable Banners + Sounds.)
2. In the ntfy app tap **+** (Add subscription).
3. **Topic name:** paste your topic from `.env` (the long random `odw-…` string, exactly).
4. Leave the server as the default (`ntfy.sh`) and tap **Subscribe**.

Your topic is effectively a password: anyone who knows it can read your alerts and send you
notifications. That's why it's long and random — never post it anywhere.

## 4. Configure .env

Already done if Claude set this up for you — the file `.env` contains `NTFY_TOPIC=…`.
To recreate it: `cp .env.example .env`, then generate a topic with `openssl rand -hex 24` and
paste it after `NTFY_TOPIC=`. `.env` is in `.gitignore` and must never be committed.

## 5. Send your first test notification

```bash
npm run test-notification
```

Your iPhone should buzz within seconds. Don't continue until it does (see §11 if not).

## 6. Run the watcher locally

```bash
npm run check        # one real check (sends alerts if something new exists)
npm run check:dry    # one check, prints what WOULD alert, sends/saves nothing
npm run watch        # keeps checking: every 2 min in release windows, 12 min otherwise
```

Note: `npm run watch` only runs while your Mac is awake — deployment (§8) covers 24/7.

## 7. What a successful check looks like

One JSON log line per event. A quiet, healthy check ends with:

```json
{"ts":"2026-08-07 18:00:12 EDT","level":"info","event":"check-complete","ok":true,
 "result":"no-change","qualifyingCount":0,"latestKnownDate":"2026-09-16",
 "alertsSent":0,"datesOnSale":41,"lastDateOnSale":"2026-09-16"}
```

- `result` — `no-change` (quiet), `alerted` (you got a push!), `would-alert` (dry-run hit),
  `suspicious-empty` / `error` (see §12; never sends an availability alert).
- `datesOnSale` / `lastDateOnSale` — how far ticket sales currently extend.
- Your ntfy topic never appears in logs (it's masked to `***` + last 4 characters).

## 8. Deploy for free (Cloudflare Workers — checks even while your Mac sleeps)

Why Cloudflare: the free plan runs cron every minute with reliable timing, far better for
catching a drop than GitHub Actions cron (5-min floor, often 5-30+ min late, silently disabled
after 60 days of repo inactivity). A GitHub Actions fallback is included in
`.github/workflows/watch.yml` if you ever prefer it (secret name: `NTFY_TOPIC`).

1. Create a free account at https://dash.cloudflare.com/sign-up (no credit card).
2. `npx wrangler login` (opens a browser window; approve access).
3. `npx wrangler kv namespace create STATE` → copy the printed `id` into `wrangler.toml`
   replacing the `REPLACE_ME…` line.
4. Set your secret (step 9) and deploy: `npx wrangler deploy`

## 9. Deployment secrets

```bash
npx wrangler secret put NTFY_TOPIC
```

Paste your topic when prompted. It's stored encrypted by Cloudflare — never in code, never in
`wrangler.toml`, never in git.

## 10. Test the deployed watcher

```bash
npx wrangler tail --format=pretty
```

Leave that running; within a couple of minutes you'll see `check-complete` lines coming from
the cloud. Real-alert drill: temporarily set `ALERT_AFTER_DATE = "2026-09-09"` in
`wrangler.toml`, `npx wrangler deploy`, wait for the next check — your phone gets a real alert
for existing dates — then set it back to `2026-09-16`, redeploy, and reset the state:
`npx wrangler kv key delete state --binding STATE --remote` (clears alert history so the
temporary test alerts don't linger as "already alerted").

## 11. Troubleshooting notifications

- **Nothing arrives:** topic in the app must match `.env` *exactly*; check iPhone
  Settings → Apps → ntfy → Notifications is allowed; try https://ntfy.sh/app → subscribe to the
  same topic in the browser to see if messages reach ntfy at all.
- **Arrives silently:** Focus/Do Not Disturb — the alert is priority "urgent", so allow ntfy in
  your Focus settings, or in the app set the topic's notification sound.
- **Arrives late:** iOS Low Power Mode can delay pushes a little.

## 12. Troubleshooting Cineplex parsing

- `cineplex-http-error` with 401/403: Cineplex rotated the public API key. Open
  https://www.cineplex.com/movie/the-odyssey → DevTools → Network → click any
  `apis.cineplex.com` request → copy the `ocp-apim-subscription-key` request header into
  `CINEPLEX_API_KEY` in `.env` (and `wrangler.toml` if deployed).
- `cineplex-parse-error` / `suspicious-empty`: Cineplex changed the response shape. The watcher
  deliberately alerts nothing rather than guessing; re-inspect the API and update
  `src/core/cineplex.ts` (schemas at the top) — fixtures live in `tests/fixtures/`.
- The watcher never emails/pushes errors to you; if checks fail for a long stretch and then
  recover, you get a single "recovered" notification.

## Safety & respect

- No purchasing, no seat holds, no checkout, no CAPTCHA/queue/anti-bot circumvention.
- ~1 request per check against a public JSON API their own site uses; honest User-Agent.
- No Cineplex login, password, or payment info — the watcher never needs any of it.
