import type { Config } from "./config.js";

function torontoParts(date: Date): { weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const weekday = (parts.find((p) => p.type === "weekday")?.value ?? "").replace(/[^a-zA-Z]/g, "");
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return { weekday, hour };
}

/** True during the configured likely-release window (Toronto time). */
export function inFastWindow(date: Date, cfg: Config): boolean {
  const { weekday, hour } = torontoParts(date);
  const [start, end] = cfg.fastWindowHours;
  const dayMatch = cfg.fastWindowDays.some(
    (d) => weekday.toLowerCase().startsWith(d.trim().slice(0, 3).toLowerCase()),
  );
  return dayMatch && hour >= start && hour < end;
}

/** Delay until the next check, with +/- jitter. Never below 30s. */
export function nextDelayMs(date: Date, cfg: Config): number {
  const baseMin = inFastWindow(date, cfg) ? cfg.fastIntervalMin : cfg.slowIntervalMin;
  const jitter = (Math.random() * 2 - 1) * cfg.jitterSeconds * 1000;
  return Math.max(30_000, baseMin * 60_000 + jitter);
}
