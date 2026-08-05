export type CalendarDate = `${number}-${number}-${number}`;

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function getDaysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }

  return DAYS_PER_MONTH[month - 1] ?? 0;
}

export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== 'string') {
    return false;
  }

  const match = CALENDAR_DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1 || month < 1 || month > 12) {
    return false;
  }

  return day >= 1 && day <= getDaysInMonth(year, month);
}
