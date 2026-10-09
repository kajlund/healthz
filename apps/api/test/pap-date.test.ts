import { describe, expect, it } from "vitest";
import { effectivePapHealthDate } from "../src/pap-records/date.js";
import { followingCalendarDay, previousCalendarDay } from "../../web/src/pap-date.js";

describe("PAP calendar date helpers", () => {
  it.each([
    ["2026-08-14", "2026-08-15"], ["2026-04-30", "2026-05-01"], ["2026-08-31", "2026-09-01"],
    ["2025-02-28", "2025-03-01"], ["2024-02-28", "2024-02-29"], ["2024-02-29", "2024-03-01"], ["2026-12-31", "2027-01-01"],
  ])("adds one calendar day without timezone conversion: %s", (value, expected) => expect(followingCalendarDay(value)).toBe(expected));
  it.each([
    ["2026-08-15", "2026-08-14"], ["2026-05-01", "2026-04-30"], ["2026-09-01", "2026-08-31"],
    ["2025-03-01", "2025-02-28"], ["2024-03-01", "2024-02-29"], ["2024-02-29", "2024-02-28"], ["2027-01-01", "2026-12-31"],
  ])("subtracts one calendar day without timezone conversion: %s", (value, expected) => expect(previousCalendarDay(value)).toBe(expected));
  it("handles empty and invalid input predictably", () => {
    expect(followingCalendarDay("")).toBe("");
    expect(followingCalendarDay("2026-02-30")).toBe("");
    expect(previousCalendarDay("")).toBe("");
    expect(previousCalendarDay("2026-02-30")).toBe("");
  });
  it("uses Health date with a non-mutating legacy fallback", () => { const legacy = Object.freeze({ therapyDate: "2026-08-31", healthDate: null }); expect(effectivePapHealthDate({ therapyDate: "2026-08-31", healthDate: "2026-09-01" })).toBe("2026-09-01"); expect(effectivePapHealthDate(legacy)).toBe("2026-08-31"); expect(legacy.healthDate).toBeNull(); });
});

