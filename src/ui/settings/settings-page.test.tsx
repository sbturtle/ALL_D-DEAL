import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { LocalSettingsRepository } from './settings-page';
import { SettingsPage } from './settings-page';

const savedSettings = {
  id: 'current',
  monthlyLivingExpenseGoalMinor: 300_000,
  updatedAt: '2026-08-05T00:00:00.000Z',
} as const;

function createRepository(
  overrides: Partial<LocalSettingsRepository> = {},
): LocalSettingsRepository {
  return {
    getLocalUserSettings: vi.fn().mockResolvedValue(undefined),
    saveLocalUserSettings: vi.fn().mockResolvedValue(undefined),
    removeLocalUserSettings: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SettingsPage', () => {
  it('saves a positive monthly goal only in the local settings repository', async () => {
    const user = userEvent.setup();
    const saveLocalUserSettings = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsPage
        settingsRepository={createRepository({ saveLocalUserSettings })}
      />,
    );

    const input = await screen.findByRole('textbox', { name: '월 생활비 목표' });
    await user.type(input, '300000');
    await user.click(screen.getByRole('button', { name: '목표 저장' }));

    expect(saveLocalUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'current',
        monthlyLivingExpenseGoalMinor: 300_000,
      }),
    );
    expect(
      await screen.findByText('월 생활비 목표를 이 기기에 저장했어요.'),
    ).toBeVisible();
  });

  it('shows an input error without writing a missing goal', async () => {
    const user = userEvent.setup();
    const saveLocalUserSettings = vi.fn();
    render(
      <SettingsPage
        settingsRepository={createRepository({ saveLocalUserSettings })}
      />,
    );

    await screen.findByRole('textbox', { name: '월 생활비 목표' });
    await user.click(screen.getByRole('button', { name: '목표 저장' }));

    expect(
      await screen.findByText('월 생활비 목표는 0보다 큰 원 단위 정수로 입력해 주세요.'),
    ).toBeVisible();
    expect(saveLocalUserSettings).not.toHaveBeenCalled();
  });

  it('clears an existing goal by removing the local singleton record', async () => {
    const user = userEvent.setup();
    const removeLocalUserSettings = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsPage
        settingsRepository={createRepository({
          getLocalUserSettings: vi.fn().mockResolvedValue(savedSettings),
          removeLocalUserSettings,
        })}
      />,
    );

    const input = await screen.findByRole('textbox', { name: '월 생활비 목표' });
    expect(input).toHaveValue('300,000');
    await user.click(screen.getByRole('button', { name: '목표 비우기' }));

    expect(removeLocalUserSettings).toHaveBeenCalledOnce();
    expect(input).toHaveValue('');
    expect(
      await screen.findByText('월 생활비 목표를 이 기기에서 비웠어요.'),
    ).toBeVisible();
  });

  it('keeps the current goal intact when saving fails', async () => {
    const user = userEvent.setup();
    render(
      <SettingsPage
        settingsRepository={createRepository({
          getLocalUserSettings: vi.fn().mockResolvedValue(savedSettings),
          saveLocalUserSettings: vi.fn().mockRejectedValue(new Error('failed')),
        })}
      />,
    );

    const input = await screen.findByRole('textbox', { name: '월 생활비 목표' });
    await user.clear(input);
    await user.type(input, '320000');
    await user.click(screen.getByRole('button', { name: '목표 저장' }));

    expect(
      await screen.findByText(
        '월 생활비 목표를 저장하지 못했습니다. 기존 설정은 변경되지 않았습니다.',
      ),
    ).toBeVisible();
    expect(input).toHaveValue('320,000');
  });
});
