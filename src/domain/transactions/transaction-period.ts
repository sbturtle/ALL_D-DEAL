import { isCalendarDate } from './calendar-date';
import type { CalendarDate } from './calendar-date';

export const TRANSACTION_PERIOD_PRESETS = [
  'DAY',
  'WEEK',
  'MONTH',
  'CUSTOM',
] as const;

export type TransactionPeriodPreset =
  (typeof TRANSACTION_PERIOD_PRESETS)[number];

export type TransactionDateRange = Readonly<{
  startOn: CalendarDate;
  endOn: CalendarDate;
}>;

export type TransactionPeriodRangeResult =
  | Readonly<{ isValid: true; value: TransactionDateRange }>
  | Readonly<{
      isValid: false;
      code: 'invalid_anchor_date' | 'invalid_custom_date' | 'invalid_date_order';
    }>;

function formatCalendarDate(year: number, month: number, day: number): CalendarDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day,
  ).padStart(2, '0')}` as CalendarDate;
}

function getDateParts(value: CalendarDate) {
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10)),
  };
}

function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function shiftCalendarDate(value: CalendarDate, amount: number): CalendarDate {
  let { year, month, day } = getDateParts(value);
  let remaining = amount;

  while (remaining < 0) {
    if (day > 1) {
      day -= 1;
    } else if (month > 1) {
      month -= 1;
      day = getDaysInMonth(year, month);
    } else {
      year -= 1;
      month = 12;
      day = 31;
    }

    remaining += 1;
  }

  while (remaining > 0) {
    if (day < getDaysInMonth(year, month)) {
      day += 1;
    } else if (month < 12) {
      month += 1;
      day = 1;
    } else {
      year += 1;
      month = 1;
      day = 1;
    }

    remaining -= 1;
  }

  return formatCalendarDate(year, month, day);
}

export function isTransactionPeriodPreset(
  value: unknown,
): value is TransactionPeriodPreset {
  return TRANSACTION_PERIOD_PRESETS.includes(value as TransactionPeriodPreset);
}

export function isDateInTransactionRange(
  occurredOn: CalendarDate,
  range: TransactionDateRange,
): boolean {
  return occurredOn >= range.startOn && occurredOn <= range.endOn;
}

export function getTransactionDateRange(
  preset: TransactionPeriodPreset,
  anchorOn: unknown,
  customRange?: Readonly<{ startOn: unknown; endOn: unknown }>,
): TransactionPeriodRangeResult {
  if (!isCalendarDate(anchorOn)) {
    return { isValid: false, code: 'invalid_anchor_date' };
  }

  if (preset === 'DAY') {
    return { isValid: true, value: { startOn: anchorOn, endOn: anchorOn } };
  }

  if (preset === 'WEEK') {
    return {
      isValid: true,
      value: { startOn: shiftCalendarDate(anchorOn, -6), endOn: anchorOn },
    };
  }

  if (preset === 'MONTH') {
    const { year, month } = getDateParts(anchorOn);
    return {
      isValid: true,
      value: {
        startOn: formatCalendarDate(year, month, 1),
        endOn: formatCalendarDate(year, month, getDaysInMonth(year, month)),
      },
    };
  }

  if (
    customRange === undefined ||
    !isCalendarDate(customRange.startOn) ||
    !isCalendarDate(customRange.endOn)
  ) {
    return { isValid: false, code: 'invalid_custom_date' };
  }

  if (customRange.startOn > customRange.endOn) {
    return { isValid: false, code: 'invalid_date_order' };
  }

  return {
    isValid: true,
    value: { startOn: customRange.startOn, endOn: customRange.endOn },
  };
}
