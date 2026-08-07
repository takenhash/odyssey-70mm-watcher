import type { QualifyingSession, WatcherState } from "./types.js";

export interface Decision {
  /** Sessions that should trigger an alert this check. */
  fresh: QualifyingSession[];
  /** Fresh sessions grouped by date. */
  byDate: Map<string, QualifyingSession[]>;
  /** Dates never seen before (later than everything previously observed). */
  brandNewDates: string[];
  /** State to persist if (and only if) alerts are actually delivered. */
  nextState: WatcherState;
}

export function decideAlerts(
  sessions: QualifyingSession[],
  state: WatcherState,
  alertAfterISO: string,
  nowISO: string,
): Decision {
  const alerted = new Set(state.alertedKeys);
  const fresh = sessions.filter((s) => s.dateISO > alertAfterISO && !alerted.has(s.key));

  const byDate = new Map<string, QualifyingSession[]>();
  for (const s of fresh) {
    const list = byDate.get(s.dateISO) ?? [];
    list.push(s);
    byDate.set(s.dateISO, list);
  }

  const prevLatest = state.latestQualifyingDateSeen ?? alertAfterISO;
  const brandNewDates = [...byDate.keys()].filter((d) => d > prevLatest).sort();
  const maxSeen = sessions.reduce((max, s) => (s.dateISO > max ? s.dateISO : max), prevLatest);

  const nextState: WatcherState =
    fresh.length === 0
      ? state
      : {
          latestQualifyingDateSeen: maxSeen,
          // Keep the most recent 1000 keys so the file can never grow unbounded.
          alertedKeys: [...state.alertedKeys, ...fresh.map((s) => s.key)].slice(-1000),
          updatedAt: nowISO,
        };

  return { fresh, byDate, brandNewDates, nextState };
}
