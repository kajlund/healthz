import { describe, expect, it } from "vitest";
import { emptyJournalFilters, formatCalendarDate, parseJournalFilters, serializeJournalFilters } from "../src/journal-helpers.js";
const one = "3bd395b9-6d1d-4e4f-ae88-b06de082f29c"; const two = "cd193842-b59e-44cc-90d8-f995f189a90c";
describe("journal filter URL state", () => {
  it("parses search, tags, all matching and pagination", () => expect(parseJournalFilters(`#/journal?search=clinic&tagIds=${one},${two}&tagMatch=all&page=2`)).toMatchObject({ search: "clinic", tagIds: [one, two], tagMatch: "all", page: 2 }));
  it("serializes only active non-default filters", () => expect(serializeJournalFilters({ ...emptyJournalFilters(), search: "flu", tagIds: [one], tagMatch: "all" })).toBe(`search=flu&tagIds=${one}&tagMatch=all`));
  it("clears to an empty query", () => expect(serializeJournalFilters(emptyJournalFilters())).toBe(""));
  it("formats a calendar date without UTC parsing", () => expect(formatCalendarDate("2025-10-14", { year: "numeric", month: "2-digit", day: "2-digit" })).toMatch(/2025/));
});
