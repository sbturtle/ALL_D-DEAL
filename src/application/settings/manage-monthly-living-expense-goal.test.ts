import { describe, expect, it, vi } from 'vitest';

import {
  clearMonthlyLivingExpenseGoal,
  saveMonthlyLivingExpenseGoal,
} from './manage-monthly-living-expense-goal';

const updatedAt = '2026-08-05T00:00:00.000Z' as const;

describe('manageMonthlyLivingExpenseGoal', () => {
  it('saves a validated goal without any transaction payload', async () => {
    const saveLocalUserSettings = vi.fn().mockResolvedValue(undefined);

    await expect(
      saveMonthlyLivingExpenseGoal(
        { monthlyLivingExpenseGoalMinor: 300_000, updatedAt },
        {
          saveLocalUserSettings,
          removeLocalUserSettings: vi.fn(),
        },
      ),
    ).resolves.toEqual({
      isSaved: true,
      settings: {
        id: 'current',
        monthlyLivingExpenseGoalMinor: 300_000,
        updatedAt,
      },
    });
    expect(saveLocalUserSettings).toHaveBeenCalledWith(
      expect.not.objectContaining({ transactions: expect.anything() }),
    );
  });

  it('does not write an invalid goal', async () => {
    const saveLocalUserSettings = vi.fn();

    await expect(
      saveMonthlyLivingExpenseGoal(
        { monthlyLivingExpenseGoalMinor: 0, updatedAt },
        {
          saveLocalUserSettings,
          removeLocalUserSettings: vi.fn(),
        },
      ),
    ).resolves.toEqual({ isSaved: false, code: 'invalid_goal' });
    expect(saveLocalUserSettings).not.toHaveBeenCalled();
  });

  it('reports a storage failure while leaving the existing record untouched', async () => {
    await expect(
      saveMonthlyLivingExpenseGoal(
        { monthlyLivingExpenseGoalMinor: 300_000, updatedAt },
        {
          saveLocalUserSettings: vi.fn().mockRejectedValue(new Error('failed')),
          removeLocalUserSettings: vi.fn(),
        },
      ),
    ).resolves.toEqual({ isSaved: false, code: 'storage_failed' });
  });

  it('removes the singleton goal record safely', async () => {
    const removeLocalUserSettings = vi.fn().mockResolvedValue(undefined);

    await expect(
      clearMonthlyLivingExpenseGoal({
        saveLocalUserSettings: vi.fn(),
        removeLocalUserSettings,
      }),
    ).resolves.toEqual({ isCleared: true });
    expect(removeLocalUserSettings).toHaveBeenCalledOnce();
  });
});
