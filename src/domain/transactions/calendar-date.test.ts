import { describe, expect, it } from 'vitest';

import { isCalendarDate } from './calendar-date';

describe('isCalendarDate', () => {
  it.each([
    '0001-01-01',
    '2026-08-05',
    '2024-02-29',
    '2000-02-29',
    '9999-12-31',
  ])('%s를 실제 달력 날짜로 허용한다', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each([
    '0000-01-01',
    '2025-02-29',
    '1900-02-29',
    '2026-00-10',
    '2026-13-10',
    '2026-04-31',
    '2026-01-00',
    '2026-1-01',
    '2026-01-1',
    ' 2026-08-05',
    '2026-08-05 ',
    '2026-08-05T00:00:00Z',
    '',
  ])('%s를 CalendarDate로 거부한다', (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });

  it.each([null, undefined, 20260805, {}, []])(
    '문자열이 아닌 %j를 거부한다',
    (value) => {
      expect(isCalendarDate(value)).toBe(false);
    },
  );
});
