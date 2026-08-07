import { z } from "zod";
import { registerSecret } from "./log.js";

const EnvSchema = z.object({
  NTFY_TOPIC: z
    .string()
    .min(16, "NTFY_TOPIC missing or too short — copy .env.example to .env and follow README step 4"),
  NTFY_SERVER: z.string().default("https://ntfy.sh"),
  CINEPLEX_API_KEY: z.string().min(10).default("dcdac5601d864addbc2675a2e96cb1f8"),
  LOCATION_ID: z.coerce.number().int().default(9406),
  FILM_ID: z.coerce.number().int().default(37617),
  FILM_NAME_HINT: z.string().default("odyssey"),
  THEATRE_NAME: z.string().default("Cinéma Banque Scotia Montréal"),
  ALERT_AFTER_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2026-09-16"),
  FAST_INTERVAL_MINUTES: z.coerce.number().min(1).default(2),
  SLOW_INTERVAL_MINUTES: z.coerce.number().min(1).default(12),
  FAST_WINDOW_DAYS: z.string().default("Tue,Wed,Thu"),
  FAST_WINDOW_HOURS: z.string().regex(/^\d{2}-\d{2}$/).default("07-14"),
  JITTER_SECONDS: z.coerce.number().min(0).default(20),
  DRY_RUN: z.enum(["true", "false"]).default("false"),
  RECOVERY_AFTER_FAILURES: z.coerce.number().min(1).default(25),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: Record<string, string | undefined>) {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration — ${issues}`);
  }
  const e = parsed.data;
  registerSecret(e.NTFY_TOPIC);
  return {
    ntfyTopic: e.NTFY_TOPIC,
    ntfyServer: e.NTFY_SERVER.replace(/\/$/, ""),
    apiKey: e.CINEPLEX_API_KEY,
    locationId: e.LOCATION_ID,
    filmId: e.FILM_ID,
    filmNameHint: e.FILM_NAME_HINT.toLowerCase(),
    theatreName: e.THEATRE_NAME,
    alertAfterDate: e.ALERT_AFTER_DATE,
    fastIntervalMin: e.FAST_INTERVAL_MINUTES,
    slowIntervalMin: e.SLOW_INTERVAL_MINUTES,
    fastWindowDays: e.FAST_WINDOW_DAYS.split(",").map((s) => s.trim()),
    fastWindowHours: e.FAST_WINDOW_HOURS.split("-").map(Number) as [number, number],
    jitterSeconds: e.JITTER_SECONDS,
    dryRun: e.DRY_RUN === "true",
    recoveryAfterFailures: e.RECOVERY_AFTER_FAILURES,
  };
}
