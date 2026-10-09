export interface JournalFilters { search: string; from: string; to: string; tagIds: string[]; tagMatch: "any" | "all"; page: number; pageSize: number; }
export const emptyJournalFilters = (): JournalFilters => ({ search: "", from: "", to: "", tagIds: [], tagMatch: "any", page: 1, pageSize: 25 });
export const parseJournalFilters = (hash = location.hash): JournalFilters => {
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query); const defaults = emptyJournalFilters();
  const page = Number(params.get("page")); const pageSize = Number(params.get("pageSize"));
  return { search: params.get("search") ?? "", from: params.get("from") ?? "", to: params.get("to") ?? "",
    tagIds: [...new Set((params.get("tagIds") ?? "").split(",").filter(Boolean))], tagMatch: params.get("tagMatch") === "all" ? "all" : "any",
    page: Number.isInteger(page) && page > 0 ? page : defaults.page,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100 ? pageSize : defaults.pageSize };
};
export const serializeJournalFilters = (filters: JournalFilters) => {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.tagIds.length) params.set("tagIds", filters.tagIds.join(","));
  if (filters.tagIds.length && filters.tagMatch === "all") params.set("tagMatch", "all");
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize !== 25) params.set("pageSize", String(filters.pageSize));
  return params.toString();
};
export const localToday = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };
export const localTime = () => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
export const formatCalendarDate = (value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, options).format(new Date(year!, month! - 1, day!));
};
