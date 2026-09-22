import { describe, expect, it } from "vitest";
import {
  emptyDateFilter,
  hasActiveFilter,
  parseDateFilter,
  updateDateFilterHash,
} from "../web/measurement-filter-helpers.js";

describe("measurement-filter-helpers", () => {
  it("parses empty filter when no query is present", () => {
    expect(parseDateFilter("#/measurements/weight")).toEqual({ from: "", to: "" });
    expect(parseDateFilter("")).toEqual({ from: "", to: "" });
  });

  it("parses valid from and to dates from hash query string", () => {
    expect(parseDateFilter("#/measurements/weight?from=2026-09-01&to=2026-09-15")).toEqual({
      from: "2026-09-01",
      to: "2026-09-15",
    });
  });

  it("ignores invalid dates predictably", () => {
    expect(parseDateFilter("#/measurements/weight?from=invalid&to=2026-02-30")).toEqual({
      from: "",
      to: "2026-02-30",
    });
    expect(parseDateFilter("#/measurements/weight?from=2026-9-1")).toEqual({
      from: "",
      to: "",
    });
  });

  it("updates hash URL with new filter while retaining non-filter parameters", () => {
    const updated = updateDateFilterHash(
      "#/measurements/weight",
      { from: "2026-08-01", to: "2026-08-31" },
      "#/measurements/weight?page=2",
    );
    expect(updated).toBe("#/measurements/weight?page=2&from=2026-08-01&to=2026-08-31");

    const cleared = updateDateFilterHash(
      "#/measurements/weight",
      emptyDateFilter(),
      "#/measurements/weight?page=2&from=2026-08-01&to=2026-08-31",
    );
    expect(cleared).toBe("#/measurements/weight?page=2");
  });

  it("detects active filter state accurately", () => {
    expect(hasActiveFilter({ from: "", to: "" })).toBe(false);
    expect(hasActiveFilter({ from: "2026-09-01", to: "" })).toBe(true);
    expect(hasActiveFilter({ from: "", to: "2026-09-30" })).toBe(true);
    expect(hasActiveFilter({ from: "2026-09-01", to: "2026-09-30" })).toBe(true);
  });
});
