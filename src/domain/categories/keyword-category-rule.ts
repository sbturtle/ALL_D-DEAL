import { isCategoryId, type CategoryId } from './category';
import { normalizeMerchantName } from '../merchants/merchant-normalizer';
import { isUtcIsoInstant, type UtcIsoInstant } from '../transactions/utc-iso-instant';

export const MIN_KEYWORD_CATEGORY_RULE_LENGTH = 2;
export const MAX_KEYWORD_CATEGORY_RULE_LENGTH = 80;

export type KeywordCategoryRule = Readonly<{
  keywordNormalized: string;
  categoryId: CategoryId;
  createdAt: UtcIsoInstant;
  updatedAt: UtcIsoInstant;
}>;

export type KeywordCategoryRuleRequest = Readonly<{
  keyword: string;
  categoryId: CategoryId;
}>;

export type KeywordCategoryRuleValidationResult =
  | Readonly<{ isValid: true; value: KeywordCategoryRule }>
  | Readonly<{
      isValid: false;
      code:
        | 'invalid_root'
        | 'unexpected_field'
        | 'invalid_keyword'
        | 'unsupported_category'
        | 'invalid_timestamp';
    }>;

const KEYWORD_CATEGORY_RULE_FIELDS = [
  'keywordNormalized',
  'categoryId',
  'createdAt',
  'updatedAt',
] as const;
const keywordCategoryRuleFieldSet: ReadonlySet<string> = new Set(
  KEYWORD_CATEGORY_RULE_FIELDS,
);
const SENSITIVE_IDENTIFIER_PATTERN = /\d(?:\s*\d){4,}/u;

const SUGGESTED_KEYWORD_GROUPING_TERMS = [
  '네이버페이',
  '오더',
  '쿠팡',
] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function normalizeKeywordCategoryRuleText(value: string): string {
  return normalizeMerchantName(value).comparisonKey;
}

function isValidKeyword(keywordNormalized: string): boolean {
  return (
    keywordNormalized.length >= MIN_KEYWORD_CATEGORY_RULE_LENGTH &&
    keywordNormalized.length <= MAX_KEYWORD_CATEGORY_RULE_LENGTH &&
    !SENSITIVE_IDENTIFIER_PATTERN.test(keywordNormalized)
  );
}

export function createKeywordCategoryRule(
  request: KeywordCategoryRuleRequest,
  now: UtcIsoInstant,
): KeywordCategoryRule | null {
  const keywordNormalized = normalizeKeywordCategoryRuleText(request.keyword);

  if (!isCategoryId(request.categoryId) || !isValidKeyword(keywordNormalized)) {
    return null;
  }

  return {
    keywordNormalized,
    categoryId: request.categoryId,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateKeywordCategoryRule(
  candidate: unknown,
): KeywordCategoryRuleValidationResult {
  if (!isPlainRecord(candidate)) {
    return { isValid: false, code: 'invalid_root' };
  }

  if (
    Object.keys(candidate).some(
      (field) => !keywordCategoryRuleFieldSet.has(field),
    )
  ) {
    return { isValid: false, code: 'unexpected_field' };
  }

  const keywordNormalized = candidate.keywordNormalized;
  if (
    typeof keywordNormalized !== 'string' ||
    !isValidKeyword(keywordNormalized) ||
    keywordNormalized !== normalizeKeywordCategoryRuleText(keywordNormalized)
  ) {
    return { isValid: false, code: 'invalid_keyword' };
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
      keywordNormalized,
      categoryId: candidate.categoryId,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    },
  };
}

export function findKeywordCategoryRule(
  description: string,
  rules: readonly KeywordCategoryRule[],
): KeywordCategoryRule | undefined {
  const descriptionNormalized = normalizeKeywordCategoryRuleText(description);

  return rules
    .filter((rule) => descriptionNormalized.includes(rule.keywordNormalized))
    .sort(
      (left, right) =>
        right.keywordNormalized.length - left.keywordNormalized.length ||
        left.keywordNormalized.localeCompare(right.keywordNormalized),
    )[0];
}

export function getSuggestedKeywordGroupingTerms(
  description: string,
): readonly string[] {
  const descriptionNormalized = normalizeKeywordCategoryRuleText(description);

  return SUGGESTED_KEYWORD_GROUPING_TERMS.filter((term) =>
    descriptionNormalized.includes(normalizeKeywordCategoryRuleText(term)),
  );
}
