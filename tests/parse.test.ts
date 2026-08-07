import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CineplexParseError, extractQualifyingSessions } from "../src/core/cineplex.js";

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

const cfg = { locationId: 9406, filmId: 37617, filmNameHint: "odyssey" };

describe("extractQualifyingSessions — real captured payloads", () => {
  it("finds the three IMAX 70mm sessions on 2026-09-16", () => {
    const sessions = extractQualifyingSessions(load("showtimes-2026-09-16.json"), cfg, "2026-09-16");
    expect(sessions.map((s) => s.timeLabel)).toEqual(["2:00 PM", "6:00 PM", "10:00 PM"]);
    expect(sessions.every((s) => s.key.startsWith("2026-09-16|"))).toBe(true);
    expect(sessions.every((s) => s.buyUrl.includes("cineplex.com"))).toBe(true);
    expect(sessions[0].seatsRemaining).toBeTypeOf("number");
  });

  it("keeps ONLY IMAX+70mm when the same day also has plain 70mm and Regular", () => {
    const sessions = extractQualifyingSessions(load("showtimes-mixed-formats.json"), cfg, "2026-08-07");
    // Fixture contains ['IMAX','70mm'] x2, ['70mm'] x2, ['Regular'] x2 -> only 2 qualify.
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.experienceLabel.includes("IMAX"))).toBe(true);
  });

  it("returns nothing for a different theatre id", () => {
    expect(extractQualifyingSessions(load("showtimes-2026-09-16.json"), { ...cfg, locationId: 999 }, "2026-09-16")).toHaveLength(0);
  });

  it("treats an empty payload (date not on sale) as zero sessions, not an error", () => {
    expect(extractQualifyingSessions([], cfg, "2026-09-17")).toHaveLength(0);
  });

  it("fails safe on unexpected shapes", () => {
    expect(() => extractQualifyingSessions({ totally: "different" }, cfg, "2026-09-16")).toThrow(CineplexParseError);
    expect(() => extractQualifyingSessions([{ nope: 1 }], cfg, "2026-09-16")).toThrow(CineplexParseError);
  });
});
