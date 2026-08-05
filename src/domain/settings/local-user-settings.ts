import { isPositiveMinorAmount } from '../transactions/money';
import { isUtcIsoInstant, type UtcIsoInstant } from '../transactions/utc-iso-instant';

export const LOCAL_USER_SETTINGS_ID = 'current' as const;

export type LocalUserSettings = Readonly<{
  id: typeof LOCAL_USER_SETTINGS_ID;
  monthlyLivingExpenseGoalMinor: number;
  updatedAt: UtcIsoInstant;
}>;

export type LocalUserSettingsValidationResult =
  | Readonly<{ isValid: true; value: LocalUserSettings }>
  | Readonly<{
      isValid: false;
      code:
        | 'invalid_root'
        | 'unexpected_field'
        | 'invalid_id'
        | 'invalid_monthly_living_expense_goal'
        | 'invalid_updated_at';
    }>;

const LOCAL_USER_SETTINGS_FIELDS = [
  'id',
  'monthlyLivingExpenseGoalMinor',
  'updatedAt',
] as const;
const localUserSettingsFieldSet: ReadonlySet<string> = new Set(
  LOCAL_USER_SETTINGS_FIELDS,
);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateLocalUserSettings(
  candidate: unknown,
): LocalUserSettingsValidationResult {
  if (!isPlainRecord(candidate)) {
    return { isValid: false, code: 'invalid_root' };
  }

  if (
    Object.keys(candidate).some(
      (field) => !localUserSettingsFieldSet.has(field),
    )
  ) {
    return { isValid: false, code: 'unexpected_field' };
  }

  if (candidate.id !== LOCAL_USER_SETTINGS_ID) {
    return { isValid: false, code: 'invalid_id' };
  }

  if (!isPositiveMinorAmount(candidate.monthlyLivingExpenseGoalMinor)) {
    return { isValid: false, code: 'invalid_monthly_living_expense_goal' };
  }

  if (!isUtcIsoInstant(candidate.updatedAt)) {
    return { isValid: false, code: 'invalid_updated_at' };
  }

  return {
    isValid: true,
    value: {
      id: LOCAL_USER_SETTINGS_ID,
      monthlyLivingExpenseGoalMinor: candidate.monthlyLivingExpenseGoalMinor,
      updatedAt: candidate.updatedAt,
    },
  };
}

export function createLocalUserSettings(
  monthlyLivingExpenseGoalMinor: unknown,
  updatedAt: unknown,
): LocalUserSettings | undefined {
  const validation = validateLocalUserSettings({
    id: LOCAL_USER_SETTINGS_ID,
    monthlyLivingExpenseGoalMinor,
    updatedAt,
  });

  return validation.isValid ? validation.value : undefined;
}
