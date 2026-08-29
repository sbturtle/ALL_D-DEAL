import {
  isCustomCategoryId,
  type CustomCategoryId,
} from './category';
import { isUtcIsoInstant, type UtcIsoInstant } from '../transactions/utc-iso-instant';

export const MAX_CUSTOM_CATEGORY_NAME_LENGTH = 30;
export const MAX_CUSTOM_CATEGORY_EMOJI_LENGTH = 8;

export type CustomCategory = Readonly<{
  id: CustomCategoryId;
  name: string;
  emoji: string;
  createdAt: UtcIsoInstant;
  updatedAt: UtcIsoInstant;
}>;

export type CustomCategoryValidationResult =
  | Readonly<{ isValid: true; value: CustomCategory }>
  | Readonly<{
      isValid: false;
      code:
        | 'invalid_root'
        | 'unexpected_field'
        | 'invalid_id'
        | 'invalid_name'
        | 'invalid_emoji'
        | 'invalid_timestamp';
    }>;

const CUSTOM_CATEGORY_FIELDS = [
  'id',
  'name',
  'emoji',
  'createdAt',
  'updatedAt',
] as const;
const customCategoryFieldSet: ReadonlySet<string> = new Set(
  CUSTOM_CATEGORY_FIELDS,
);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= MAX_CUSTOM_CATEGORY_NAME_LENGTH
  );
}

function isValidEmoji(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Array.from(value.trim()).length <= MAX_CUSTOM_CATEGORY_EMOJI_LENGTH
  );
}

export function createCustomCategory(
  input: Readonly<{
    id: CustomCategoryId;
    name: string;
    emoji: string;
  }>,
  now: UtcIsoInstant,
): CustomCategory | undefined {
  if (
    !isCustomCategoryId(input.id) ||
    !isValidName(input.name) ||
    !isValidEmoji(input.emoji)
  ) {
    return undefined;
  }

  return {
    id: input.id,
    name: input.name.trim(),
    emoji: input.emoji.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function validateCustomCategory(
  candidate: unknown,
): CustomCategoryValidationResult {
  if (!isPlainRecord(candidate)) {
    return { isValid: false, code: 'invalid_root' };
  }

  if (Object.keys(candidate).some((field) => !customCategoryFieldSet.has(field))) {
    return { isValid: false, code: 'unexpected_field' };
  }

  if (!isCustomCategoryId(candidate.id)) {
    return { isValid: false, code: 'invalid_id' };
  }
  if (!isValidName(candidate.name) || candidate.name !== candidate.name.trim()) {
    return { isValid: false, code: 'invalid_name' };
  }
  if (
    !isValidEmoji(candidate.emoji) ||
    candidate.emoji !== candidate.emoji.trim()
  ) {
    return { isValid: false, code: 'invalid_emoji' };
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
      id: candidate.id,
      name: candidate.name,
      emoji: candidate.emoji,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    },
  };
}
