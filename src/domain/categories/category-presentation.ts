import type { CategoryId } from './category';

export type CategoryPresentation = Readonly<{
  label: string;
  emoji: string;
}>;

export const CATEGORY_PRESENTATIONS: Readonly<
  Record<CategoryId, CategoryPresentation>
> = {
  FOOD_DINING: { label: '식비·외식', emoji: '🍚' },
  CAFE: { label: '카페', emoji: '☕' },
  CONVENIENCE: { label: '편의점', emoji: '🏪' },
  TRANSPORT: { label: '교통', emoji: '🚇' },
  HOUSING_UTILITIES: { label: '주거·공과금', emoji: '🏠' },
  SHOPPING: { label: '쇼핑', emoji: '🛍️' },
  HEALTH: { label: '건강', emoji: '💪' },
  EDUCATION: { label: '교육', emoji: '📚' },
  LEISURE: { label: '여가', emoji: '🎮' },
  CULTURE: { label: '문화', emoji: '🎬' },
  MEDICAL: { label: '의료', emoji: '💊' },
  DATE: { label: '데이트', emoji: '💐' },
  SUBSCRIPTION: { label: '구독', emoji: '📱' },
  OTHER: { label: '기타', emoji: '🏷️' },
};

export const UNCLASSIFIED_CATEGORY_PRESENTATION: CategoryPresentation = {
  label: '미분류',
  emoji: '🏷️',
};

export function getCategoryPresentation(
  categoryId: CategoryId | undefined,
): CategoryPresentation {
  return categoryId === undefined
    ? UNCLASSIFIED_CATEGORY_PRESENTATION
    : CATEGORY_PRESENTATIONS[categoryId];
}
