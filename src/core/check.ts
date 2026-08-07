import {
  CineplexHttpError,
  CineplexParseError,
  fetchBookableDates,
  fetchQualifyingSessions,
  showtimesPageUrl,
} from "./cineplex.js";
import type { Config } from "./config.js";
import { decideAlerts } from "./decide.js";
import { log } from "./log.js";
import { formatDateAlert, publish } from "./notify.js";
import type { CheckSummary, StateAdapter } from "./types.js";

const MAX_DETAILED_ALERTS_PER_CHECK = 4;

/**
 * One complete availability check:
 *   1 request for the bookable-dates list; only if dates beyond the baseline
 *   exist, 1 more request per such date to confirm real IMAX 70mm sessions.
 * Errors are logged, counted, and NEVER produce an availability alert.
 */
export async function runCheck(cfg: Config, store: StateAdapter, dryRun: boolean): Promise<CheckSummary> {
  const runtime = await store.loadRuntime();
  const state = await store.loadState();
  try {
    const dates = await fetchBookableDates(cfg);

    if (dates.length === 0) {
      // The film currently plays daily; zero dates means "shape changed" or an
      // API hiccup far more likely than "gone everywhere". Fail safe: no alert.
      log("warn", "suspicious-empty-dates", {
        note: "API reachable but returned zero bookable dates; not alerting, not updating state",
      });
      await store.saveRuntime({ ...runtime, consecutiveFailures: runtime.consecutiveFailures + 1 });
      return {
        ok: false,
        result: "suspicious-empty",
        qualifyingCount: 0,
        latestKnownDate: state.latestQualifyingDateSeen ?? cfg.alertAfterDate,
        alertsSent: 0,
      };
    }

    const candidateDates = dates.filter((d) => d > cfg.alertAfterDate);
    const sessions = [];
    for (const d of candidateDates) sessions.push(...(await fetchQualifyingSessions(cfg, d)));

    const decision = decideAlerts(sessions, state, cfg.alertAfterDate, new Date().toISOString());
    let alertsSent = 0;

    if (decision.fresh.length > 0) {
      const entries = [...decision.byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
      if (dryRun) {
        for (const [dateISO, list] of entries) {
          log("info", "would-alert", {
            date: dateISO,
            brandNewDate: decision.brandNewDates.includes(dateISO),
            times: list.map((s) => s.timeLabel),
            seats: list.map((s) => s.seatsRemaining ?? null),
            url: list[0]?.buyUrl,
          });
        }
      } else {
        for (const [dateISO, list] of entries.slice(0, MAX_DETAILED_ALERTS_PER_CHECK)) {
          await publish(cfg, formatDateAlert(cfg, dateISO, list, decision.brandNewDates.includes(dateISO)));
          alertsSent += 1;
        }
        const overflow = entries.slice(MAX_DETAILED_ALERTS_PER_CHECK).map(([d]) => d);
        if (overflow.length > 0) {
          await publish(cfg, {
            title: "🎬 More Odyssey 70mm dates on sale",
            body: `Also new: ${overflow.join(", ")}`,
            clickUrl: showtimesPageUrl(overflow[0]),
            priority: 5,
          });
          alertsSent += 1;
        }
        await store.saveState(decision.nextState);
      }
    }

    const recovered = runtime.consecutiveFailures >= cfg.recoveryAfterFailures;
    await store.saveRuntime({ lastSuccessfulCheckAt: new Date().toISOString(), consecutiveFailures: 0 });
    if (recovered && !dryRun) {
      await publish(cfg, {
        title: "✅ Odyssey watcher recovered",
        body: `Checks are working again after ${runtime.consecutiveFailures} consecutive failures.`,
        priority: 3,
        tags: ["white_check_mark"],
      });
    }

    const summary: CheckSummary = {
      ok: true,
      result: decision.fresh.length === 0 ? "no-change" : dryRun ? "would-alert" : "alerted",
      qualifyingCount: sessions.length,
      latestKnownDate:
        (dryRun ? state : decision.nextState).latestQualifyingDateSeen ?? cfg.alertAfterDate,
      alertsSent,
    };
    log("info", "check-complete", {
      ...summary,
      datesOnSale: dates.length,
      lastDateOnSale: dates[dates.length - 1],
    });
    return summary;
  } catch (err) {
    const kind =
      err instanceof CineplexParseError
        ? "cineplex-parse-error"
        : err instanceof CineplexHttpError
          ? "cineplex-http-error"
          : "unexpected-error";
    log("error", kind, {
      message: err instanceof Error ? err.message : String(err),
      consecutiveFailures: runtime.consecutiveFailures + 1,
      note: "errors never trigger availability alerts",
    });
    await store.saveRuntime({ ...runtime, consecutiveFailures: runtime.consecutiveFailures + 1 });
    return {
      ok: false,
      result: "error",
      qualifyingCount: 0,
      latestKnownDate: state.latestQualifyingDateSeen ?? cfg.alertAfterDate,
      alertsSent: 0,
    };
  }
}
