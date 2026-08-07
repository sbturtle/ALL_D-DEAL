import { describe, expect, it } from 'vitest';

import {
  createKeywordCategoryRule,
  findKeywordCategoryRule,
  getSuggestedKeywordGroupingTerms,
  normalizeKeywordCategoryRuleText,
  validateKeywordCategoryRule,
} from './keyword-category-rule';

const createdAt = '2026-08-07T00:00:00.000Z' as const;

describe('keyword category rules', () => {
  it('normalizes a user-confirmed keyword across spaces and punctuation', () => {
    const rule = createKeywordCategoryRule(
      { keyword: ' 네이버-페이 ', categoryId: 'SHOPPING' },
      createdAt,
    );

    expect(normalizeKeywordCategoryRuleText(' 네이버-페이 ')).toBe('네이버페이');
    expect(rule).toEqual({
      keywordNormalized: '네이버페이',
      categoryId: 'SHOPPING',
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('chooses the longest included keyword and then a stable lexical tie-breaker', () => {
    const broadRule = createKeywordCategoryRule(
      { keyword: '쿠팡', categoryId: 'SHOPPING' },
      createdAt,
    );
    const specificRule = createKeywordCategoryRule(
      { keyword: '쿠팡이츠', categoryId: 'FOOD_DINING' },
      createdAt,
    );
    const alphaRule = createKeywordCategoryRule(
      { keyword: 'payco', categoryId: 'OTHER' },
      createdAt,
    );
    const betaRule = createKeywordCategoryRule(
      { keyword: 'order', categoryId: 'SHOPPING' },
      createdAt,
    );

    expect(broadRule).not.toBeNull();
    expect(specificRule).not.toBeNull();
    expect(alphaRule).not.toBeNull();
    expect(betaRule).not.toBeNull();
    expect(
      findKeywordCategoryRule('Fabricated 쿠팡이츠 order', [
        broadRule!,
        specificRule!,
      ]),
    ).toEqual(specificRule);
    expect(
      findKeywordCategoryRule('Fabricated PAYCO order', [
        betaRule!,
        alphaRule!,
      ]),
    ).toEqual(betaRule);
  });

  it('rejects unsafe keywords and validates only normalized stored rules', () => {
    expect(
      createKeywordCategoryRule({ keyword: 'A', categoryId: 'SHOPPING' }, createdAt),
    ).toBeNull();
    expect(
      createKeywordCategoryRule(
        { keyword: '123 456 789', categoryId: 'SHOPPING' },
        createdAt,
      ),
    ).toBeNull();

    const rule = {
      keywordNormalized: '쿠팡',
      categoryId: 'SHOPPING',
      createdAt,
      updatedAt: createdAt,
    } as const;
    expect(validateKeywordCategoryRule(rule)).toEqual({ isValid: true, value: rule });
    expect(
      validateKeywordCategoryRule({ ...rule, keywordNormalized: '쿠 팡' }),
    ).toEqual({ isValid: false, code: 'invalid_keyword' });
  });

  it('suggests only known terms that the current description already contains', () => {
    expect(getSuggestedKeywordGroupingTerms('Fabricated 네이버 페이 오더')).toEqual([
      '네이버페이',
      '오더',
    ]);
    expect(getSuggestedKeywordGroupingTerms('Fabricated merchant')).toEqual([]);
  });
});
