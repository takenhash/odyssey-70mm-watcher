import "dotenv/config";
import { runCheck } from "../core/check.js";
import { loadConfig } from "../core/config.js";
import { log } from "../core/log.js";
import { inFastWindow, nextDelayMs } from "../core/schedule.js";
import { fsStateAdapter } from "../local/state.js";

const cfg = loadConfig(process.env);
const store = fsStateAdapter();
const dryRun = process.argv.includes("--dry-run") || cfg.dryRun;

log("info", "watcher-started", {
  fastEveryMin: cfg.fastIntervalMin,
  slowEveryMin: cfg.slowIntervalMin,
  fastWindow: `${cfg.fastWindowDays.join("/")} ${cfg.fastWindowHours[0]}h-${cfg.fastWindowHours[1]}h Toronto`,
  dryRun,
});

process.on("SIGINT", () => {
  log("info", "watcher-stopped");
  process.exit(0);
});

while (true) {
  await runCheck(cfg, store, dryRun);
  const delay = nextDelayMs(new Date(), cfg);
  log("info", "next-check", {
    inMinutes: Math.round(delay / 6_000) / 10,
    fastWindow: inFastWindow(new Date(), cfg),
  });
  await new Promise((r) => setTimeout(r, delay));
}
