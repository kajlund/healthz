const leapYear = (year: number) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const daysInMonth = (year: number, month: number) =>
  month === 2
    ? leapYear(year)
      ? 29
      : 28
    : [4, 6, 9, 11].includes(month)
      ? 30
      : 31;
export const followingCalendarDay = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';
  let year = Number(match[1]);
  let month = Number(match[2]);
  let day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month))
    return '';
  day++;
  if (day > daysInMonth(year, month)) {
    day = 1;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
export const previousCalendarDay = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';
  let year = Number(match[1]);
  let month = Number(match[2]);
  let day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month))
    return '';
  day--;
  if (day < 1) {
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    day = daysInMonth(year, month);
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
