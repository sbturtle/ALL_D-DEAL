import { describe, expect, it } from 'vitest';

import {
  getTransactionDateRange,
  isDateInTransactionRange,
} from './transaction-period';

describe('getTransactionDateRange', () => {
  it('selects one exact day', () => {
    expect(getTransactionDateRange('DAY', '2026-08-05')).toEqual({
      isValid: true,
      value: { startOn: '2026-08-05', endOn: '2026-08-05' },
    });
  });

  it('includes the anchor day and six prior calendar days for a week', () => {
    expect(getTransactionDateRange('WEEK', '2026-03-01')).toEqual({
      isValid: true,
      value: { startOn: '2026-02-23', endOn: '2026-03-01' },
    });
  });

  it('uses the full calendar month, including leap day', () => {
    expect(getTransactionDateRange('MONTH', '2028-02-11')).toEqual({
      isValid: true,
      value: { startOn: '2028-02-01', endOn: '2028-02-29' },
    });
  });

  it('uses both custom range boundaries', () => {
    expect(
      getTransactionDateRange('CUSTOM', '2026-08-05', {
        startOn: '2026-07-20',
        endOn: '2026-08-05',
      }),
    ).toEqual({
      isValid: true,
      value: { startOn: '2026-07-20', endOn: '2026-08-05' },
    });
  });

  it('rejects malformed and reverse custom ranges', () => {
    expect(
      getTransactionDateRange('CUSTOM', '2026-08-05', {
        startOn: '2026-08-06',
        endOn: '2026-08-05',
      }),
    ).toEqual({ isValid: false, code: 'invalid_date_order' });

    expect(
      getTransactionDateRange('CUSTOM', '2026-08-05', {
        startOn: '2026-08-01',
        endOn: '2026-08-42',
      }),
    ).toEqual({ isValid: false, code: 'invalid_custom_date' });
  });
});

describe('isDateInTransactionRange', () => {
  it('includes both bounds', () => {
    const range = { startOn: '2026-08-01', endOn: '2026-08-05' } as const;

    expect(isDateInTransactionRange('2026-08-01', range)).toBe(true);
    expect(isDateInTransactionRange('2026-08-05', range)).toBe(true);
    expect(isDateInTransactionRange('2026-08-06', range)).toBe(false);
  });
});
