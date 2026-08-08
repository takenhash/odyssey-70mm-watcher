import "dotenv/config";
import { runCheck } from "../core/check.js";
import { loadConfig } from "../core/config.js";
import { log } from "../core/log.js";
import { fsStateAdapter } from "../local/state.js";

const cfg = loadConfig(process.env);
const dryRun = process.argv.includes("--dry-run") || cfg.dryRun;
if (dryRun) {
  log("info", "dry-run-mode", { note: "nothing will be sent and no state will be saved" });
}
// A failed check is logged (and, after a long outage, pushed once to your phone),
// but it does NOT fail the process: Cineplex hiccups are routine and a red CI run
// per hiccup just generates email noise. Bad configuration still throws above,
// which exits non-zero and surfaces loudly.
await runCheck(cfg, fsStateAdapter(), dryRun);
