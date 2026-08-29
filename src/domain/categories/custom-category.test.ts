import { describe, expect, it } from 'vitest';

import {
  createCustomCategory,
  validateCustomCategory,
} from './custom-category';

const createdAt = '2026-08-29T00:00:00.000Z' as const;
const categoryId = 'CUSTOM_550e8400-e29b-41d4-a716-446655440010' as const;

describe('custom categories', () => {
  it('creates and validates a local category with a stable id', () => {
    const category = createCustomCategory(
      {
        id: categoryId,
        name: '반려동물',
        emoji: '🐾',
      },
      createdAt,
    );

    expect(category).toEqual({
      id: categoryId,
      name: '반려동물',
      emoji: '🐾',
      createdAt,
      updatedAt: createdAt,
    });
    expect(validateCustomCategory(category)).toEqual({
      isValid: true,
      value: category,
    });
  });

  it('rejects blank names and fields outside the local category contract', () => {
    expect(
      createCustomCategory(
        {
          id: categoryId,
          name: '   ',
          emoji: '🐾',
        },
        createdAt,
      ),
    ).toBeUndefined();
    expect(
      validateCustomCategory({
        id: categoryId,
        name: '반려동물',
        emoji: '🐾',
        createdAt,
        updatedAt: createdAt,
        privateValue: 'nope',
      }),
    ).toEqual({ isValid: false, code: 'unexpected_field' });
  });
});
