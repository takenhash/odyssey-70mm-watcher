import { z } from "zod";
import type { Config } from "./config.js";
import { apiDateToISO, isImax70mm, isoToApiDate, sessionTimeLabel } from "./format.js";
import type { QualifyingSession } from "./types.js";

const API_BASE = "https://apis.cineplex.com/prod/cpx/theatrical/api/v1";

export class CineplexHttpError extends Error {
  constructor(public status: number, url: string) {
    super(`Cineplex API returned HTTP ${status} for ${url}`);
  }
}
export class CineplexParseError extends Error {}

// Schemas mirror the real payloads captured on 2026-08-07 (see tests/fixtures/).
// Only fields the watcher relies on are validated; extra fields are ignored.
const DatesBookableSchema = z.array(z.string().min(8));

const SessionSchema = z.object({
  vistaSessionId: z.union([z.string(), z.number()]).transform(String),
  showStartDateTime: z.string(),
  isSoldOut: z.boolean().optional(),
  seatsRemaining: z.number().nullable().optional(),
  deeplinkUrl: z.string().nullable().optional(),
});
const ExperienceSchema = z.object({
  experienceTypes: z.array(z.string()).default([]),
  sessions: z.array(SessionSchema).default([]),
});
const MovieSchema = z.object({
  id: z.number(),
  name: z.string(),
  experiences: z.array(ExperienceSchema).default([]),
});
const DateBlockSchema = z.object({
  startDate: z.string(),
  movies: z.array(MovieSchema).default([]),
});
const TheatreBlockSchema = z.object({
  theatreId: z.number(),
  dates: z.array(DateBlockSchema).default([]),
});
const ShowtimesSchema = z.array(TheatreBlockSchema);

async function apiGet(cfg: Config, path: string): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "ocp-apim-subscription-key": cfg.apiKey,
      accept: "application/json",
      "accept-language": "en-CA",
      "user-agent": "odyssey-70mm-watcher/1.0 (personal showtime availability checker)",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new CineplexHttpError(res.status, url);
  // "Not on sale" for a date is an EMPTY body (observed live), not an error or [].
  const text = await res.text();
  if (text.trim() === "") return [];
  try {
    return JSON.parse(text);
  } catch {
    throw new CineplexParseError(`Response was not JSON (first 80 chars: ${text.slice(0, 80)})`);
  }
}

/** All dates (ISO, ascending) with any bookable Odyssey show at the theatre. */
export async function fetchBookableDates(cfg: Config): Promise<string[]> {
  const raw = await apiGet(cfg, `/dates/bookable?filmId=${cfg.filmId}&locationId=${cfg.locationId}`);
  const parsed = DatesBookableSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CineplexParseError(`dates/bookable shape changed: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data.map(apiDateToISO).sort();
}

/** Parse a showtimes payload into qualifying IMAX-70mm sessions. Exported for tests. */
export function extractQualifyingSessions(
  raw: unknown,
  cfg: Pick<Config, "locationId" | "filmId" | "filmNameHint">,
  dateISO: string,
): QualifyingSession[] {
  const parsed = ShowtimesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CineplexParseError(`showtimes shape changed: ${parsed.error.issues[0]?.message}`);
  }
  const out: QualifyingSession[] = [];
  for (const theatre of parsed.data) {
    if (theatre.theatreId !== cfg.locationId) continue;
    for (const day of theatre.dates) {
      if (apiDateToISO(day.startDate) !== dateISO) continue;
      for (const movie of day.movies) {
        const nameMatches = movie.name.toLowerCase().includes(cfg.filmNameHint);
        if (movie.id !== cfg.filmId && !nameMatches) continue;
        for (const exp of movie.experiences) {
          if (!isImax70mm(exp.experienceTypes)) continue;
          for (const s of exp.sessions) {
            out.push({
              key: `${dateISO}|${s.vistaSessionId}`,
              dateISO,
              timeLabel: sessionTimeLabel(s.showStartDateTime),
              experienceLabel: exp.experienceTypes.join(" "),
              seatsRemaining: s.seatsRemaining ?? undefined,
              isSoldOut: s.isSoldOut ?? undefined,
              buyUrl:
                s.deeplinkUrl && s.deeplinkUrl.startsWith("https://")
                  ? s.deeplinkUrl
                  : showtimesPageUrl(dateISO),
            });
          }
        }
      }
    }
  }
  return out;
}

export async function fetchQualifyingSessions(cfg: Config, dateISO: string): Promise<QualifyingSession[]> {
  const date = encodeURIComponent(isoToApiDate(dateISO));
  const raw = await apiGet(
    cfg,
    `/showtimes?language=en&locationId=${cfg.locationId}&date=${date}&filmId=${cfg.filmId}`,
  );
  return extractQualifyingSessions(raw, cfg, dateISO);
}

/** Human showtimes page — fallback tap target for notifications. */
export function showtimesPageUrl(_dateISO: string): string {
  return "https://www.cineplex.com/movie/the-odyssey";
}
