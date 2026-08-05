import { describe, expect, it } from 'vitest';

import { calculateMonthlyLivingExpenseGoalProgress } from './monthly-living-expense-goal-progress';

const settings = {
  monthlyLivingExpenseGoalMinor: 300_000,
} as const;

describe('calculateMonthlyLivingExpenseGoalProgress', () => {
  it('does not fabricate progress when a goal is unset', () => {
    expect(calculateMonthlyLivingExpenseGoalProgress(undefined, 0)).toBeUndefined();
  });

  it('returns the remaining amount for spending within the goal', () => {
    expect(calculateMonthlyLivingExpenseGoalProgress(settings, 125_000)).toEqual({
      goalAmountMinor: 300_000,
      usedAmountMinor: 125_000,
      status: 'WITHIN_GOAL',
      differenceAmountMinor: 175_000,
    });
  });

  it('returns the exceeded amount instead of a negative remaining amount', () => {
    expect(calculateMonthlyLivingExpenseGoalProgress(settings, 325_000)).toEqual({
      goalAmountMinor: 300_000,
      usedAmountMinor: 325_000,
      status: 'EXCEEDED',
      differenceAmountMinor: 25_000,
    });
  });

  it('rejects invalid spending amounts', () => {
    expect(calculateMonthlyLivingExpenseGoalProgress(settings, -1)).toBeUndefined();
  });
});
