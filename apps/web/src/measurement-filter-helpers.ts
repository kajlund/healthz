export interface DateFilter {
  from: string;
  to: string;
}

export const emptyDateFilter = (): DateFilter => ({ from: '', to: '' });

const validDate = (value: string | null | undefined): string =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';

export const parseDateFilter = (
  hash: string = window.location.hash,
): DateFilter => {
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) return emptyDateFilter();
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  return {
    from: validDate(params.get('from')),
    to: validDate(params.get('to')),
  };
};

export const updateDateFilterHash = (
  basePath: string,
  filter: DateFilter,
  currentHash: string = window.location.hash,
): string => {
  const queryIndex = currentHash.indexOf('?');
  const params = new URLSearchParams(
    queryIndex >= 0 ? currentHash.slice(queryIndex + 1) : '',
  );
  if (filter.from) params.set('from', filter.from);
  else params.delete('from');
  if (filter.to) params.set('to', filter.to);
  else params.delete('to');
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ''}`;
};

export const hasActiveFilter = (filter: DateFilter): boolean =>
  Boolean(filter.from || filter.to);
