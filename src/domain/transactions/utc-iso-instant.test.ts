import { describe, expect, it } from 'vitest';

import { isUtcIsoInstant } from './utc-iso-instant';

describe('isUtcIsoInstant', () => {
  it.each([
    '0001-01-01T00:00:00Z',
    '2024-02-29T23:59:59Z',
    '2026-08-05T07:31:00.1Z',
    '2026-08-05T07:31:00.123Z',
    '9999-12-31T23:59:59.999Z',
  ])('%s를 UTC ISO instant로 허용한다', (value) => {
    expect(isUtcIsoInstant(value)).toBe(true);
  });

  it.each([
    '0000-01-01T00:00:00Z',
    '2025-02-29T00:00:00Z',
    '2026-08-05T24:00:00Z',
    '2026-08-05T23:60:00Z',
    '2026-08-05T23:59:60Z',
    '2026-08-05T07:31:00.1234Z',
    '2026-08-05T07:31:00+00:00',
    '2026-08-05T16:31:00+09:00',
    '2026-08-05T07:31:00',
    '2026-08-05',
    ' 2026-08-05T07:31:00Z',
    '',
  ])('%s를 UTC ISO instant로 거부한다', (value) => {
    expect(isUtcIsoInstant(value)).toBe(false);
  });

  it.each([null, undefined, 20260805, {}, []])(
    '문자열이 아닌 %j를 거부한다',
    (value) => {
      expect(isUtcIsoInstant(value)).toBe(false);
    },
  );
});
