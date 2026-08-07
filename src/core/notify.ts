import type { Config } from "./config.js";
import { friendlyDate } from "./format.js";
import { log, torontoNow } from "./log.js";
import type { QualifyingSession } from "./types.js";

export class NtfyError extends Error {}

export interface NtfyMessage {
  title: string;
  body: string;
  clickUrl?: string;
  priority?: number; // 1 (min) .. 5 (urgent)
  tags?: string[];
}

/**
 * Publish via ntfy's JSON endpoint (POST to server root) — unlike the
 * header-based API this supports emoji/UTF-8 titles and click actions cleanly.
 */
export async function publish(cfg: Config, msg: NtfyMessage): Promise<void> {
  const payload: Record<string, unknown> = {
    topic: cfg.ntfyTopic,
    title: msg.title,
    message: msg.body,
    priority: msg.priority ?? 5,
    tags: msg.tags ?? ["clapper"],
  };
  if (msg.clickUrl) {
    payload.click = msg.clickUrl;
    payload.actions = [{ action: "view", label: "Buy tickets", url: msg.clickUrl, clear: true }];
  }
  const res = await fetch(cfg.ntfyServer, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new NtfyError(`ntfy responded HTTP ${res.status}`);
  log("info", "notification-sent", { title: msg.title, priority: msg.priority ?? 5 });
}

export function formatDateAlert(
  cfg: Config,
  dateISO: string,
  sessions: QualifyingSession[],
  brandNewDate: boolean,
): NtfyMessage {
  const times = sessions.map((s) => s.timeLabel).join(", ");
  const withSeats = sessions.filter((s) => typeof s.seatsRemaining === "number");
  const seatLine =
    withSeats.length > 0
      ? `Seats left: ${withSeats.map((s) => `${s.timeLabel} → ${s.seatsRemaining}`).join(", ")}`
      : null;
  const body = [
    `New date: ${friendlyDate(dateISO)}`,
    cfg.theatreName,
    "IMAX 70mm",
    `Showtimes: ${times}`,
    ...(seatLine ? [seatLine] : []),
    "Tap to buy tickets:",
    `Detected: ${torontoNow()}`,
  ].join("\n");
  return {
    title: brandNewDate ? "🎬 ODYSSEY 70MM TICKETS LIVE" : "🎬 New Odyssey 70mm showtime",
    body,
    clickUrl: sessions[0]?.buyUrl,
    priority: 5,
    tags: ["clapper", "rotating_light"],
  };
}
