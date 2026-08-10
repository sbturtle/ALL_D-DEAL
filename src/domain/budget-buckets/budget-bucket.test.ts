import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUDGET_BUCKETS,
  getDefaultBudgetBucket,
  validateBudgetBucket,
} from './budget-bucket';

describe('BudgetBucket', () => {
  it('provides seven editable future-ready default buckets', () => {
    expect(DEFAULT_BUDGET_BUCKETS.map((bucket) => bucket.id)).toEqual([
      'LIVING',
      'IRREGULAR',
      'EMERGENCY',
      'SAVING',
      'HOUSING_MARRIAGE',
      'INVESTMENT',
      'OTHER',
    ]);
    expect(getDefaultBudgetBucket('EMERGENCY')).toMatchObject({
      name: '비상금',
      icon: '🛟',
    });
  });

  it('allows a future custom bucket ID without treating defaults as a fixed enum', () => {
    const bucket = {
      id: 'travel-2026',
      name: '여행',
      icon: '✈️',
      order: 80,
      isDefault: false,
      isArchived: false,
    } as const;

    expect(validateBudgetBucket(bucket)).toEqual({
      isValid: true,
      value: bucket,
    });
  });

  it('rejects incomplete and unexpected stored bucket data', () => {
    expect(
      validateBudgetBucket({
        ...DEFAULT_BUDGET_BUCKETS[0],
        id: ' ',
        extra: true,
      }),
    ).toEqual(
      expect.objectContaining({
        isValid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ field: 'id', code: 'invalid_id' }),
          expect.objectContaining({ field: '$root', code: 'unexpected_field' }),
        ]),
      }),
    );
  });
});
