import { describe, expect, it } from 'vitest';

import {
  createCategoryRule,
  normalizeCategoryRuleDescription,
  validateCategoryRule,
} from './category-rule';

const createdAt = '2026-08-05T00:00:00.000Z' as const;

describe('category rules', () => {
  it('normalizes an exact description key and creates a local rule', () => {
    const rule = createCategoryRule(
      {
        descriptionOriginal: ' Fabricated Cafe — Seoul! ',
        categoryId: 'FOOD_DINING',
      },
      createdAt,
    );

    expect(normalizeCategoryRuleDescription(' Fabricated Cafe — Seoul! ')).toBe(
      'fabricated cafe seoul',
    );
    expect(rule).toEqual({
      matchDescriptionNormalized: 'fabricated cafe seoul',
      categoryId: 'FOOD_DINING',
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('rejects rules with unnormalized keys, unsupported categories, or added fields', () => {
    const rule = {
      matchDescriptionNormalized: 'fabricated cafe',
      categoryId: 'FOOD_DINING',
      createdAt,
      updatedAt: createdAt,
    } as const;

    expect(validateCategoryRule(rule)).toEqual({ isValid: true, value: rule });
    expect(
      validateCategoryRule({ ...rule, matchDescriptionNormalized: 'Fabricated Cafe' }),
    ).toEqual({ isValid: false, code: 'invalid_match_description' });
    expect(validateCategoryRule({ ...rule, categoryId: 'UNKNOWN' })).toEqual({
      isValid: false,
      code: 'unsupported_category',
    });
    expect(validateCategoryRule({ ...rule, privateValue: 'not allowed' })).toEqual({
      isValid: false,
      code: 'unexpected_field',
    });
  });

  it('does not create a rule from a description containing a long numeric identifier', () => {
    expect(
      createCategoryRule(
        {
          descriptionOriginal: 'Fabricated account 123456789',
          categoryId: 'OTHER',
        },
        createdAt,
      ),
    ).toBeNull();
  });
});
