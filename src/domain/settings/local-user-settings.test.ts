import { describe, expect, it } from 'vitest';

import {
  LOCAL_USER_SETTINGS_ID,
  createLocalUserSettings,
  validateLocalUserSettings,
} from './local-user-settings';

const updatedAt = '2026-08-05T00:00:00.000Z' as const;

describe('LocalUserSettings', () => {
  it('creates one validated local monthly goal record', () => {
    expect(createLocalUserSettings(300_000, updatedAt)).toEqual({
      id: LOCAL_USER_SETTINGS_ID,
      monthlyLivingExpenseGoalMinor: 300_000,
      updatedAt,
    });
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid monthly goal: %s',
    (monthlyLivingExpenseGoalMinor) => {
      expect(
        createLocalUserSettings(monthlyLivingExpenseGoalMinor, updatedAt),
      ).toBeUndefined();
    },
  );

  it('rejects a stored record with unexpected fields', () => {
    expect(
      validateLocalUserSettings({
        id: LOCAL_USER_SETTINGS_ID,
        monthlyLivingExpenseGoalMinor: 300_000,
        updatedAt,
        unrelatedData: 'must not persist',
      }),
    ).toEqual({ isValid: false, code: 'unexpected_field' });
  });
});
