import {
  createLocalUserSettings,
  type LocalUserSettings,
} from '../../domain/settings/local-user-settings';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';

export type MonthlyLivingExpenseGoalRepository = Readonly<{
  saveLocalUserSettings: (settings: LocalUserSettings) => Promise<void>;
  removeLocalUserSettings: () => Promise<void>;
}>;

export type SaveMonthlyLivingExpenseGoalInput = Readonly<{
  monthlyLivingExpenseGoalMinor: number;
  updatedAt: UtcIsoInstant;
}>;

export type SaveMonthlyLivingExpenseGoalResult =
  | Readonly<{ isSaved: true; settings: LocalUserSettings }>
  | Readonly<{ isSaved: false; code: 'invalid_goal' | 'storage_failed' }>;

export type ClearMonthlyLivingExpenseGoalResult =
  | Readonly<{ isCleared: true }>
  | Readonly<{ isCleared: false; code: 'storage_failed' }>;

export async function saveMonthlyLivingExpenseGoal(
  input: SaveMonthlyLivingExpenseGoalInput,
  repository: MonthlyLivingExpenseGoalRepository,
): Promise<SaveMonthlyLivingExpenseGoalResult> {
  const settings = createLocalUserSettings(
    input.monthlyLivingExpenseGoalMinor,
    input.updatedAt,
  );

  if (settings === undefined) {
    return { isSaved: false, code: 'invalid_goal' };
  }

  try {
    await repository.saveLocalUserSettings(settings);
    return { isSaved: true, settings };
  } catch {
    return { isSaved: false, code: 'storage_failed' };
  }
}

export async function clearMonthlyLivingExpenseGoal(
  repository: MonthlyLivingExpenseGoalRepository,
): Promise<ClearMonthlyLivingExpenseGoalResult> {
  try {
    await repository.removeLocalUserSettings();
    return { isCleared: true };
  } catch {
    return { isCleared: false, code: 'storage_failed' };
  }
}
