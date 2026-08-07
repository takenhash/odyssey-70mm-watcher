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
  lastSuccessfulCheckAt: string | null;
  consecutiveFailures: number;
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
  lastSuccessfulCheckAt: null,
  consecutiveFailures: 0,
};
