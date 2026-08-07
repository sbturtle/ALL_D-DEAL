import { describe, expect, it } from 'vitest';

import { normalizeMerchantName } from './merchant-normalizer';

describe('normalizeMerchantName', () => {
  it('keeps the original value while normalizing Unicode, punctuation, and whitespace', () => {
    expect(normalizeMerchantName('  ＧＳ２５  (대전법동점)  ')).toEqual({
      original: '  ＧＳ２５  (대전법동점)  ',
      normalized: 'GS25 대전법동점',
      comparisonKey: 'gs25대전법동점',
    });
  });

  it('creates a case-insensitive comparison key without changing the display text meaning', () => {
    expect(normalizeMerchantName('Mega-MGC Coffee 법동점')).toEqual({
      original: 'Mega-MGC Coffee 법동점',
      normalized: 'Mega MGC Coffee 법동점',
      comparisonKey: 'megamgccoffee법동점',
    });
  });
});
