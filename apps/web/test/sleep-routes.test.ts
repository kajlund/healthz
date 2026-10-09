import { describe, expect, it } from "vitest";
import { parseSleepRoute, safeSleepReturnTo, sleepEditorUrl, sleepListUrl } from "../src/sleep-routes.js";

describe("Sleep routes", () => {
  const id = "ec450dda-f51c-41df-9c31-2fe4f1ba4ab4";
  it("round-trips the list query through editor URLs", () => {
    const list = `${sleepListUrl}?month=2026-09&source=watch%20%26%20manual&page=2`;
    expect(parseSleepRoute(sleepEditorUrl(null, list))).toEqual({ kind: "new", id: null, returnTo: list });
    expect(parseSleepRoute(sleepEditorUrl(id, list))).toEqual({ kind: "edit", id, returnTo: list });
    expect(parseSleepRoute(list).returnTo).toBe(list);
  });
  it("falls back to the list for external, unrelated or nested-hash destinations", () => {
    for (const value of [null, "https://example.com", "javascript:alert(1)", "#/journal", `${sleepListUrl}/new`, `${sleepListUrl}?x=1#/journal`]) {
      expect(safeSleepReturnTo(value)).toBe(sleepListUrl);
    }
    expect(parseSleepRoute(`${sleepListUrl}/new`).returnTo).toBe(sleepListUrl);
  });
  it("rejects malformed and missing IDs and accepts a directly loaded edit URL", () => {
    for (const path of ["/edit", "//edit", "/bad/edit", "/%zz/edit", "/new/edit"]) {
      expect(parseSleepRoute(sleepListUrl + path).kind).toBe("invalid");
    }
    expect(parseSleepRoute(`${sleepListUrl}/${id}/edit`)).toEqual({ kind: "edit", id, returnTo: sleepListUrl });
  });
});
