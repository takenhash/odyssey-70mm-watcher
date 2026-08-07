import { describe, expect, it } from "vitest";
import { decideAlerts } from "../src/core/decide.js";
import { EMPTY_STATE, type QualifyingSession } from "../src/core/types.js";

const session = (dateISO: string, id: string, timeLabel = "6:00 PM"): QualifyingSession => ({
  key: `${dateISO}|${id}`,
  dateISO,
  timeLabel,
  experienceLabel: "IMAX 70mm",
  buyUrl: "https://example.test/buy",
});
const NOW = "2026-08-07T12:00:00Z";
const BASELINE = "2026-09-16";

describe("decideAlerts — date logic and duplicate protection", () => {
  it("alerts for a date strictly after the baseline", () => {
    const d = decideAlerts([session("2026-09-17", "1")], EMPTY_STATE, BASELINE, NOW);
    expect(d.fresh).toHaveLength(1);
    expect(d.brandNewDates).toEqual(["2026-09-17"]);
  });

  it("does NOT alert for the baseline date itself", () => {
    const d = decideAlerts([session("2026-09-16", "1")], EMPTY_STATE, BASELINE, NOW);
    expect(d.fresh).toHaveLength(0);
  });

  it("never alerts twice for the same showtime", () => {
    const first = decideAlerts([session("2026-09-17", "1")], EMPTY_STATE, BASELINE, NOW);
    const second = decideAlerts([session("2026-09-17", "1")], first.nextState, BASELINE, NOW);
    expect(second.fresh).toHaveLength(0);
  });

  it("alerts exactly once more when a new time is added to an already-alerted date", () => {
    const first = decideAlerts([session("2026-09-17", "1")], EMPTY_STATE, BASELINE, NOW);
    const second = decideAlerts(
      [session("2026-09-17", "1"), session("2026-09-17", "2", "10:00 PM")],
      first.nextState,
      BASELINE,
      NOW,
    );
    expect(second.fresh.map((s) => s.key)).toEqual(["2026-09-17|2"]);
    expect(second.brandNewDates).toEqual([]); // same date, so not "brand new"
  });

  it("tracks the latest qualifying date seen", () => {
    const d = decideAlerts(
      [session("2026-09-17", "1"), session("2026-09-24", "9")],
      EMPTY_STATE,
      BASELINE,
      NOW,
    );
    expect(d.nextState.latestQualifyingDateSeen).toBe("2026-09-24");
  });
});
