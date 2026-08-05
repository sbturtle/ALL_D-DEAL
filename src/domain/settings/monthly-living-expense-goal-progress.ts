import { isPositiveMinorAmount } from '../transactions/money';
import type { LocalUserSettings } from './local-user-settings';

export type MonthlyLivingExpenseGoalProgress = Readonly<{
  goalAmountMinor: number;
  usedAmountMinor: number;
  status: 'WITHIN_GOAL' | 'EXCEEDED';
  differenceAmountMinor: number;
}>;

export function calculateMonthlyLivingExpenseGoalProgress(
  settings: Pick<LocalUserSettings, 'monthlyLivingExpenseGoalMinor'> | undefined,
  usedAmountMinor: number,
): MonthlyLivingExpenseGoalProgress | undefined {
  if (
    settings === undefined ||
    !isPositiveMinorAmount(settings.monthlyLivingExpenseGoalMinor) ||
    !Number.isSafeInteger(usedAmountMinor) ||
    usedAmountMinor < 0
  ) {
    return undefined;
  }

  if (usedAmountMinor <= settings.monthlyLivingExpenseGoalMinor) {
    return {
      goalAmountMinor: settings.monthlyLivingExpenseGoalMinor,
      usedAmountMinor,
      status: 'WITHIN_GOAL',
      differenceAmountMinor:
        settings.monthlyLivingExpenseGoalMinor - usedAmountMinor,
    };
  }

  return {
    goalAmountMinor: settings.monthlyLivingExpenseGoalMinor,
    usedAmountMinor,
    status: 'EXCEEDED',
    differenceAmountMinor:
      usedAmountMinor - settings.monthlyLivingExpenseGoalMinor,
  };
}
