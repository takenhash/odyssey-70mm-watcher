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

## 8. Deploy for free (GitHub Actions — checks even while your Mac sleeps)

**Why not Cloudflare Workers?** It was tried first (config still in `wrangler.toml` /
`src/worker.ts`): Cineplex's API answers HTTP 403 to requests from Cloudflare's network while
working fine from residential connections. We don't disguise traffic or dodge blocks, so
Workers is out unless that changes. GitHub Actions runs from different (Azure) infrastructure
and is the fallback: free for public repos, but cron has a 5-minute floor, is routinely
5-30+ minutes late, and silently disables after 60 days of repo inactivity — fine for daily
"new week of dates" drops, not for minute-level racing. For the fastest reaction while your
Mac is awake, also run `npm run watch` locally; the shared state file prevents double alerts
only per machine, so expect at most one duplicate notification if both fire.

1. Create the repo (public — Actions minutes are unlimited free for public repos, and the repo
   contains no secrets): `gh repo create odyssey-70mm-watcher --public --source . --push`
2. Add the secret (step 9) and enable the schedule by pushing — the workflow is
   `.github/workflows/watch.yml`.
3. Manual test run: `gh workflow run "Odyssey 70mm check" && gh run watch`

## 9. Deployment secrets

```bash
gh secret set NTFY_TOPIC --body "$(grep '^NTFY_TOPIC=' .env | cut -d= -f2)"
```

Stored encrypted by GitHub Actions — never in the repository itself.

## 10. Test the deployed watcher

```bash
gh workflow run "Odyssey 70mm check"
gh run watch
```

The run's log ends with a `check-complete` JSON line (see §7). Real-alert drill: in the repo's
GitHub → Settings → Secrets/variables you can't override vars easily, so drill locally instead:
`ALERT_AFTER_DATE=2026-09-15 npm run check` sends one real alert for Sep 16, then delete
`state/state.json`'s `alertedKeys` entries (or `git checkout state/state.json`) so the drill
doesn't mask a real Sep 16+ alert later.

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
- **Transient errors are normal.** Cineplex occasionally answers 403 to a cloud IP for a few
  seconds. Each check retries twice with backoff, and a still-failing check is logged without
  failing the GitHub job — so you don't get a "workflow failed" email per hiccup. Only a broken
  *configuration* (e.g. missing `NTFY_TOPIC`) fails the job loudly.
- **A real outage does reach you, once.** After `RECOVERY_AFTER_FAILURES` consecutive failures
  (25 ≈ 4 hours at the deployed cadence) you get one "⚠️ watcher is failing" push, then silence,
  then one "✅ recovered" push when it works again. The counter lives in `state/runtime.json`,
  which the workflow commits so it survives between runs.

## Safety & respect

- No purchasing, no seat holds, no checkout, no CAPTCHA/queue/anti-bot circumvention.
- ~1 request per check against a public JSON API their own site uses; honest User-Agent.
- No Cineplex login, password, or payment info — the watcher never needs any of it.
