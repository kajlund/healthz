export const sleepListUrl = "#/measurements/sleep";

// Only return to this application's Sleep list; retain its query string verbatim.
export const safeSleepReturnTo = (value: string | null): string =>
  value && /^#\/measurements\/sleep(?:\?[^#]*)?$/.test(value) ? value : sleepListUrl;

export type SleepRoute = { kind: "list" | "new" | "edit" | "invalid"; id: string | null; returnTo: string };
export const parseSleepRoute = (hash: string): SleepRoute => {
  const separator = hash.indexOf("?");
  const path = separator < 0 ? hash : hash.slice(0, separator);
  const query = separator < 0 ? "" : hash.slice(separator + 1);
  const returnTo = safeSleepReturnTo(new URLSearchParams(query).get("returnTo"));
  if (path === sleepListUrl) return { kind: "list", id: null, returnTo: safeSleepReturnTo(hash) };
  if (path === `${sleepListUrl}/new`) return { kind: "new", id: null, returnTo };
  const match = /^#\/measurements\/sleep\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/edit$/i.exec(path);
  return match ? { kind: "edit", id: match[1]!, returnTo } : { kind: "invalid", id: null, returnTo };
};

export const sleepEditorUrl = (id: string | null, returnTo: string): string =>
  `${sleepListUrl}/${id ? `${encodeURIComponent(id)}/edit` : "new"}?${new URLSearchParams({ returnTo: safeSleepReturnTo(returnTo) })}`;
