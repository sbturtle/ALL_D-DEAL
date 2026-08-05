import { isCalendarDate } from './calendar-date';

export type UtcIsoInstant = `${string}Z`;

const UTC_ISO_INSTANT_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/;

export function isUtcIsoInstant(value: unknown): value is UtcIsoInstant {
  if (typeof value !== 'string') {
    return false;
  }

  const match = UTC_ISO_INSTANT_PATTERN.exec(value);

  return Boolean(match && isCalendarDate(match[1]));
}
