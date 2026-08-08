export interface QualifyingSession {
  /** Stable dedupe key: `${dateISO}|${vistaSessionId}` */
  key: string;
  dateISO: string;
  timeLabel: string;
  experienceLabel: string;
  seatsRemaining?: number;
  isSoldOut?: boolean;
  buyUrl: string;
}

export interface WatcherState {
  latestQualifyingDateSeen: string | null;
  alertedKeys: string[];
  updatedAt: string | null;
}

export interface RuntimeState {
  /** Date-only (YYYY-MM-DD) so a healthy watcher rewrites this at most once a day. */
  lastSuccessDate: string | null;
  consecutiveFailures: number;
  /** Ensures the "watcher is down" warning is sent once per outage, not per check. */
  downAlertSent: boolean;
}

/** Storage backend: JSON files locally, Cloudflare KV when deployed. */
export interface StateAdapter {
  loadState(): Promise<WatcherState>;
  saveState(s: WatcherState): Promise<void>;
  loadRuntime(): Promise<RuntimeState>;
  saveRuntime(s: RuntimeState): Promise<void>;
}

export interface CheckSummary {
  ok: boolean;
  result: "no-change" | "alerted" | "would-alert" | "suspicious-empty" | "error";
  qualifyingCount: number;
  latestKnownDate: string | null;
  alertsSent: number;
}

export const EMPTY_STATE: WatcherState = {
  latestQualifyingDateSeen: null,
  alertedKeys: [],
  updatedAt: null,
};

export const EMPTY_RUNTIME: RuntimeState = {
  lastSuccessDate: null,
  consecutiveFailures: 0,
  downAlertSent: false,
};
