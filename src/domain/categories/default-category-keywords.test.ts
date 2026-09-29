import { describe, expect, it } from 'vitest';

import { isBuiltInCategoryId } from './category';
import {
  DEFAULT_CATEGORY_KEYWORDS,
  findDefaultCategoryKeyword,
} from './default-category-keywords';
import { normalizeKeywordCategoryRuleText } from './keyword-category-rule';

describe('findDefaultCategoryKeyword', () => {
  it.each([
    ['가짜 스타벅스 테스트점', 'CAFE'],
    ['STARBUCKS FAKE', 'CAFE'],
    ['가짜 버거킹 샘플점', 'FOOD_DINING'],
    ['CGV 가짜관', 'CULTURE'],
    ['쿠팡(주) 가짜', 'SHOPPING'],
    ['GS25 가짜점', 'CONVENIENCE'],
    ['NETFLIX.COM FAKE', 'SUBSCRIPTION'],
  ] as const)('suggests %s as %s', (description, categoryId) => {
    expect(findDefaultCategoryKeyword(description)?.categoryId).toBe(categoryId);
  });

  it('prefers the longest matching keyword', () => {
    expect(findDefaultCategoryKeyword('가짜 쿠팡이츠 주문')?.categoryId).toBe(
      'FOOD_DINING',
    );
    expect(findDefaultCategoryKeyword('가짜 이마트24 샘플점')?.categoryId).toBe(
      'CONVENIENCE',
    );
    expect(findDefaultCategoryKeyword('가짜 이마트 샘플점')?.categoryId).toBe(
      'SHOPPING',
    );
  });

  it('leaves unknown or empty descriptions unclassified', () => {
    expect(findDefaultCategoryKeyword('Fabricated unknown shop')).toBeUndefined();
    expect(findDefaultCategoryKeyword('!!!')).toBeUndefined();
  });

  it('keeps every keyword valid, unique and mapped to a built-in category', () => {
    const normalizedKeywords = DEFAULT_CATEGORY_KEYWORDS.map((entry) =>
      normalizeKeywordCategoryRuleText(entry.keyword),
    );

    expect(new Set(normalizedKeywords).size).toBe(normalizedKeywords.length);
    normalizedKeywords.forEach((keyword) =>
      expect(keyword.length).toBeGreaterThanOrEqual(2),
    );
    DEFAULT_CATEGORY_KEYWORDS.forEach((entry) =>
      expect(isBuiltInCategoryId(entry.categoryId)).toBe(true),
    );
  });
});
