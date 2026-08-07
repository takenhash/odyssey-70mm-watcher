type Level = "info" | "warn" | "error";

const secrets: string[] = [];

/** Register a value (e.g. the ntfy topic) that must never appear in log output. */
export function registerSecret(secret: string): void {
  if (secret && !secrets.includes(secret)) secrets.push(secret);
}

function scrub(text: string): string {
  let out = text;
  for (const s of secrets) out = out.split(s).join(`***${s.slice(-4)}`);
  return out;
}

/** Current time in America/Toronto, e.g. "2026-08-07 10:03:41 EDT" */
export function torontoNow(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} ${get("timeZoneName")}`;
}

/** One structured JSON line per event; topic is always masked. */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: torontoNow(), level, event, ...fields });
  (level === "error" ? console.error : console.log)(scrub(line));
}
