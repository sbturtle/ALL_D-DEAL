export const CATEGORY_IDS = [
  'FOOD_DINING',
  'CAFE',
  'CONVENIENCE',
  'TRANSPORT',
  'HOUSING_UTILITIES',
  'SHOPPING',
  'HEALTH',
  'EDUCATION',
  'LEISURE',
  'CULTURE',
  'MEDICAL',
  'DATE',
  'SUBSCRIPTION',
  'OTHER',
] as const;

export type BuiltInCategoryId = (typeof CATEGORY_IDS)[number];
export type CustomCategoryId = `CUSTOM_${string}`;
export type CategoryId = BuiltInCategoryId | CustomCategoryId;

const categoryIdSet: ReadonlySet<unknown> = new Set(CATEGORY_IDS);

export function isCustomCategoryId(value: unknown): value is CustomCategoryId {
  return (
    typeof value === 'string' &&
    /^CUSTOM_[a-z0-9-]{8,80}$/.test(value)
  );
}

export function isBuiltInCategoryId(
  value: unknown,
): value is BuiltInCategoryId {
  return categoryIdSet.has(value);
}

export function isCategoryId(value: unknown): value is CategoryId {
  return isBuiltInCategoryId(value) || isCustomCategoryId(value);
}
