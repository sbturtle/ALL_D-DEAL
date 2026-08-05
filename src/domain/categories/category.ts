export const CATEGORY_IDS = [
  'FOOD_DINING',
  'TRANSPORT',
  'HOUSING_UTILITIES',
  'SHOPPING',
  'HEALTH',
  'EDUCATION',
  'LEISURE',
  'SUBSCRIPTION',
  'OTHER',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

const categoryIdSet: ReadonlySet<unknown> = new Set(CATEGORY_IDS);

export function isCategoryId(value: unknown): value is CategoryId {
  return categoryIdSet.has(value);
}
