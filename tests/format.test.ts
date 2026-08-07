import { describe, expect, it } from "vitest";
import { apiDateToISO, isImax70mm, sessionTimeLabel } from "../src/core/format.js";

describe("isImax70mm — the format gate", () => {
  it("matches the exact labels Cineplex uses today (['IMAX','70mm'])", () => {
    expect(isImax70mm(["IMAX", "70mm"])).toBe(true);
  });
  it("matches defensive variants (order, spacing, wording, accents)", () => {
    expect(isImax70mm(["70MM IMAX"])).toBe(true);
    expect(isImax70mm(["IMAX 70 mm Film"])).toBe(true);
    expect(isImax70mm(["Pellicule IMAX 70 mm"])).toBe(true);
  });
  it("rejects plain IMAX (digital)", () => {
    expect(isImax70mm(["IMAX"])).toBe(false);
  });
  it("rejects plain 70mm without IMAX (this combo really exists at Banque Scotia)", () => {
    expect(isImax70mm(["70mm"])).toBe(false);
    expect(isImax70mm(["70mm Film Projection"])).toBe(false);
  });
  it("rejects other formats", () => {
    expect(isImax70mm(["Regular"])).toBe(false);
    expect(isImax70mm(["UltraAVX"])).toBe(false);
    expect(isImax70mm(["VIP 19+"])).toBe(false);
  });
  it("does not treat '1570mm' style strings as 70mm", () => {
    expect(isImax70mm(["IMAX 1570mm"])).toBe(false);
  });
});

describe("date and time parsing", () => {
  it("parses both API date shapes to ISO", () => {
    expect(apiDateToISO("2026-09-16T00:00:00")).toBe("2026-09-16");
    expect(apiDateToISO("9/17/2026")).toBe("2026-09-17");
  });
  it("throws on unknown date shapes instead of guessing", () => {
    expect(() => apiDateToISO("16 septembre 2026")).toThrow();
  });
  it("formats session times", () => {
    expect(sessionTimeLabel("2026-09-16T14:00:00")).toBe("2:00 PM");
    expect(sessionTimeLabel("2026-09-16T09:05:00")).toBe("9:05 AM");
    expect(sessionTimeLabel("2026-09-16T00:15:00")).toBe("12:15 AM");
  });
});
