import { afterEach, describe, expect, it, vi } from "vitest";
import { runCheck } from "../src/core/check.js";
import { loadConfig } from "../src/core/config.js";
import {
  EMPTY_RUNTIME,
  EMPTY_STATE,
  type RuntimeState,
  type StateAdapter,
  type WatcherState,
} from "../src/core/types.js";

const cfg = loadConfig({ NTFY_TOPIC: "test-topic-0123456789abcdef", RECOVERY_AFTER_FAILURES: "3" });

function memoryStore(runtime: RuntimeState = EMPTY_RUNTIME) {
  let state: WatcherState = EMPTY_STATE;
  let rt = runtime;
  const adapter: StateAdapter = {
    loadState: async () => state,
    saveState: async (s) => void (state = s),
    loadRuntime: async () => rt,
    saveRuntime: async (s) => void (rt = s),
  };
  return { adapter, runtime: () => rt };
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("transient Cineplex failures", () => {
  it("retries a 403 and succeeds without alerting or warning", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes("ntfy")) throw new Error("must not notify on a recovered hiccup");
        return calls.length === 1 ? new Response("blocked", { status: 403 }) : jsonResponse([]);
      }),
    );
    const store = memoryStore();
    const summary = await runCheck(cfg, store.adapter, false);
    expect(calls.length).toBeGreaterThan(1); // proved it retried
    expect(summary.result).toBe("suspicious-empty"); // empty date list -> fail safe, no alert
    expect(summary.alertsSent).toBe(0);
  }, 20_000);

  it("sends exactly one down-warning per outage, never one per failed check", async () => {
    const pushes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("ntfy")) {
          pushes.push(JSON.parse(String(init?.body)).title);
          return new Response("ok");
        }
        return new Response("blocked", { status: 403 });
      }),
    );
    const store = memoryStore();
    for (let i = 0; i < 5; i++) await runCheck(cfg, store.adapter, false);
    expect(pushes.filter((t) => t.includes("failing"))).toHaveLength(1);
    expect(store.runtime().consecutiveFailures).toBe(5);
    expect(pushes.some((t) => t.includes("TICKETS LIVE"))).toBe(false);
  }, 60_000);
});
