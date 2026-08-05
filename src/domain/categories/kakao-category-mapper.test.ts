import { describe, expect, it } from 'vitest';
import { mapKakaoCategoryName } from './kakao-category-mapper';

describe('mapKakaoCategoryName', () => {
  it.each([
    ['음식점 > 카페 > 커피전문점', 'CAFE'],
    ['음식점 > 멕시칸,브라질 > 타코', 'FOOD_DINING'],
    ['문화,예술 > 사진 > 사진관', 'CULTURE'],
  ] as const)('maps %s to %s', (categoryName, expected) => {
    expect(mapKakaoCategoryName(categoryName)).toBe(expected);
  });
});
