// Cloudflare Worker entry — identical core logic, state in Workers KV.
// The cron fires every minute; this file decides whether the current minute
// is an actual check (every FAST_INTERVAL_MINUTES during release windows,
// every SLOW_INTERVAL_MINUTES otherwise), so free-plan usage stays tiny.
import { runCheck } from "./core/check.js";
import { loadConfig } from "./core/config.js";
import { inFastWindow } from "./core/schedule.js";
import {
  EMPTY_RUNTIME,
  EMPTY_STATE,
  type RuntimeState,
  type StateAdapter,
  type WatcherState,
} from "./core/types.js";

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
type Env = { STATE: KVNamespace } & Record<string, string | undefined | KVNamespace>;

function kvStateAdapter(kv: KVNamespace): StateAdapter {
  const readJson = async <T>(key: string, fallback: T): Promise<T> => {
    const v = await kv.get(key);
    return v ? (JSON.parse(v) as T) : fallback;
  };
  return {
    loadState: () => readJson<WatcherState>("state", EMPTY_STATE),
    saveState: (s) => kv.put("state", JSON.stringify(s)),
    loadRuntime: () => readJson<RuntimeState>("runtime", EMPTY_RUNTIME),
    saveRuntime: (s) => kv.put("runtime", JSON.stringify(s)),
  };
}

export default {
  async scheduled(controller: { scheduledTime: number }, env: Env): Promise<void> {
    const cfg = loadConfig(env as Record<string, string | undefined>);
    const firedAt = new Date(controller.scheduledTime);
    const interval = inFastWindow(firedAt, cfg) ? cfg.fastIntervalMin : cfg.slowIntervalMin;
    if (firedAt.getUTCMinutes() % interval !== 0) return;
    // Jitter inside the minute so checks never land on :00 exactly.
    await new Promise((r) => setTimeout(r, Math.random() * cfg.jitterSeconds * 1000));
    await runCheck(cfg, kvStateAdapter(env.STATE), cfg.dryRun);
  },

  async fetch(): Promise<Response> {
    return new Response("odyssey-70mm-watcher runs on a cron schedule; nothing to see here.\n", {
      status: 200,
    });
  },
};
