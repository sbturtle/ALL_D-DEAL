import { isCategoryId, type CategoryId } from './category';
import { isUtcIsoInstant, type UtcIsoInstant } from '../transactions/utc-iso-instant';

export const MAX_CATEGORY_RULE_DESCRIPTION_LENGTH = 300;

export type CategoryRule = Readonly<{
  matchDescriptionNormalized: string;
  categoryId: CategoryId;
  createdAt: UtcIsoInstant;
  updatedAt: UtcIsoInstant;
}>;

export type CategoryRuleRequest = Readonly<{
  descriptionOriginal: string;
  categoryId: CategoryId;
}>;

export type CategoryRuleValidationResult =
  | Readonly<{ isValid: true; value: CategoryRule }>
  | Readonly<{
      isValid: false;
      code:
        | 'invalid_root'
        | 'unexpected_field'
        | 'invalid_match_description'
        | 'unsupported_category'
        | 'invalid_timestamp';
    }>;

const CATEGORY_RULE_FIELDS = [
  'matchDescriptionNormalized',
  'categoryId',
  'createdAt',
  'updatedAt',
] as const;
const categoryRuleFieldSet: ReadonlySet<string> = new Set(CATEGORY_RULE_FIELDS);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function normalizeCategoryRuleDescription(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll(/[\p{P}\p{S}]/gu, ' ')
    .replaceAll(/\s+/gu, ' ')
    .trim();
}

export function createCategoryRule(
  request: CategoryRuleRequest,
  now: UtcIsoInstant,
): CategoryRule | null {
  const matchDescriptionNormalized = normalizeCategoryRuleDescription(
    request.descriptionOriginal,
  );

  if (
    matchDescriptionNormalized.length === 0 ||
    matchDescriptionNormalized.length > MAX_CATEGORY_RULE_DESCRIPTION_LENGTH
  ) {
    return null;
  }

  return {
    matchDescriptionNormalized,
    categoryId: request.categoryId,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateCategoryRule(
  candidate: unknown,
): CategoryRuleValidationResult {
  if (!isPlainRecord(candidate)) {
    return { isValid: false, code: 'invalid_root' };
  }

  if (Object.keys(candidate).some((field) => !categoryRuleFieldSet.has(field))) {
    return { isValid: false, code: 'unexpected_field' };
  }

  const matchDescriptionNormalized = candidate.matchDescriptionNormalized;
  if (
    typeof matchDescriptionNormalized !== 'string' ||
    matchDescriptionNormalized.length === 0 ||
    matchDescriptionNormalized.length > MAX_CATEGORY_RULE_DESCRIPTION_LENGTH ||
    matchDescriptionNormalized !==
      normalizeCategoryRuleDescription(matchDescriptionNormalized)
  ) {
    return { isValid: false, code: 'invalid_match_description' };
  }

  if (!isCategoryId(candidate.categoryId)) {
    return { isValid: false, code: 'unsupported_category' };
  }

  if (
    !isUtcIsoInstant(candidate.createdAt) ||
    !isUtcIsoInstant(candidate.updatedAt) ||
    Date.parse(candidate.updatedAt) < Date.parse(candidate.createdAt)
  ) {
    return { isValid: false, code: 'invalid_timestamp' };
  }

  return {
    isValid: true,
    value: {
      matchDescriptionNormalized,
      categoryId: candidate.categoryId,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    },
  };
}
