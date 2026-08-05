import { describe, expect, it } from 'vitest';

import { CATEGORY_IDS } from './category';
import {
  CATEGORY_PRESENTATIONS,
  getCategoryPresentation,
} from './category-presentation';

describe('category presentation', () => {
  it('gives every supported category a readable label and emoji', () => {
    expect(Object.keys(CATEGORY_PRESENTATIONS)).toEqual(CATEGORY_IDS);
    CATEGORY_IDS.forEach((categoryId) => {
      expect(getCategoryPresentation(categoryId).label).not.toBe('');
      expect(getCategoryPresentation(categoryId).emoji).not.toBe('');
    });
  });

  it('uses an explicit presentation for an unclassified transaction', () => {
    expect(getCategoryPresentation(undefined)).toEqual({
      label: '미분류',
      emoji: '🏷️',
    });
  });
});
