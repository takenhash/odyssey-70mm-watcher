import "dotenv/config";
import { showtimesPageUrl } from "../core/cineplex.js";
import { loadConfig } from "../core/config.js";
import { log, torontoNow } from "../core/log.js";
import { publish } from "../core/notify.js";

const cfg = loadConfig(process.env);
log("info", "sending-test-notification", { server: cfg.ntfyServer });

await publish(cfg, {
  title: "🎬 TEST — Odyssey 70mm watcher",
  body: [
    "This is a test alert. A real one will look like this:",
    "New date: (example) Thursday, September 17",
    cfg.theatreName,
    "IMAX 70mm",
    "Showtimes: 2:00 PM, 6:00 PM, 10:00 PM",
    "Tap to open the Cineplex page.",
    `Detected: ${torontoNow()}`,
  ].join("\n"),
  clickUrl: showtimesPageUrl("2026-09-17"),
  priority: 5,
  tags: ["clapper", "test_tube"],
});

console.log("\nTest notification sent — it should appear on your iPhone within a few seconds.");
