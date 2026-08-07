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
const summary = await runCheck(cfg, fsStateAdapter(), dryRun);
process.exitCode = summary.ok ? 0 : 1;
