import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_BUDGET_BUCKETS } from '../../domain/budget-buckets/budget-bucket';
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
    listBudgetBuckets: vi.fn().mockResolvedValue(DEFAULT_BUDGET_BUCKETS),
    saveBudgetBucket: vi.fn().mockResolvedValue(undefined),
    getLocalLedgerSnapshot: vi.fn().mockResolvedValue({
      transactions: [],
      importBatches: [],
      budgetSettlements: [],
      categoryRules: [],
      keywordCategoryRules: [],
      userSettings: null,
      budgetBuckets: DEFAULT_BUDGET_BUCKETS,
      customCategories: [],
      transactionAttachments: [],
    }),
    replaceLocalLedger: vi.fn().mockResolvedValue(undefined),
    resetLocalLedger: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SettingsPage', () => {
  it('shows the saved goal and explains that it stays in this browser', async () => {
    render(
      <SettingsPage
        settingsRepository={createRepository({
          getLocalUserSettings: vi.fn().mockResolvedValue(savedSettings),
        })}
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: '생활비 목표를 내 기준으로 정해볼까요?',
        level: 1,
      }),
    ).toBeVisible();
    expect(await screen.findByText('300,000원')).toBeVisible();
    expect(
      screen.getByText('이 브라우저에만 저장하며 외부로 전송하지 않아요.'),
    ).toBeVisible();
  });

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

  it('adds and presentation-edits a custom money purpose', async () => {
    const user = userEvent.setup();
    let storedBuckets = [...DEFAULT_BUDGET_BUCKETS];
    const saveBudgetBucket = vi.fn().mockImplementation(async (bucket) => {
      storedBuckets = [
        ...storedBuckets.filter((candidate) => candidate.id !== bucket.id),
        bucket,
      ];
    });
    render(
      <SettingsPage
        settingsRepository={createRepository({
          listBudgetBuckets: vi.fn().mockImplementation(async () => storedBuckets),
          saveBudgetBucket,
        })}
      />,
    );

    const nameInput = await screen.findByRole('textbox', {
      name: '새 돈의 목적 이름',
    });
    await user.type(screen.getByRole('textbox', { name: '새 돈의 목적 아이콘' }), '✈️');
    await user.type(nameInput, '여행');
    await user.click(screen.getByRole('button', { name: '목적 추가' }));

    expect(saveBudgetBucket).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '여행',
        icon: '✈️',
        isDefault: false,
        isArchived: false,
      }),
    );
    expect(await screen.findByText('새 돈의 목적을 추가했어요.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '여행 이름과 아이콘 편집' }));
    const editNameInput = screen.getByRole('textbox', {
      name: '편집할 돈의 목적 이름',
    });
    await user.clear(editNameInput);
    await user.type(editNameInput, '긴 여행');
    await user.click(screen.getByRole('button', { name: '변경 저장' }));

    expect(saveBudgetBucket).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: '긴 여행', icon: '✈️' }),
    );
    expect(await screen.findByText('돈의 목적을 바꿨어요.')).toBeVisible();
  });

  it('archives only a custom purpose and keeps it visible in the archived list', async () => {
    const user = userEvent.setup();
    const customBucket = {
      id: 'custom-travel',
      name: '여행',
      icon: '✈️',
      order: 80,
      isDefault: false,
      isArchived: false,
    } as const;
    const saveBudgetBucket = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsPage
        settingsRepository={createRepository({
          listBudgetBuckets: vi.fn().mockResolvedValue([
            ...DEFAULT_BUDGET_BUCKETS,
            customBucket,
          ]),
          saveBudgetBucket,
        })}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: '여행 보관' }),
    );

    expect(saveBudgetBucket).toHaveBeenCalledWith({
      ...customBucket,
      isArchived: true,
    });
    expect(screen.queryByRole('button', { name: '여행 보관' })).not.toBeInTheDocument();
    await user.click(screen.getByText('보관한 목적'));
    expect(screen.getByText('✈️ 여행')).toBeVisible();
    expect(screen.queryByRole('button', { name: '생활비 보관' })).not.toBeInTheDocument();
  });

  it('opens a scoped reset confirmation and lets the user cancel without clearing data', async () => {
    const user = userEvent.setup();
    const resetLocalLedger = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsPage settingsRepository={createRepository({ resetLocalLedger })} />,
    );

    await screen.findByRole('textbox', { name: '월 생활비 목표' });
    const resetTrigger = screen.getByRole('button', {
      name: '로컬 장부 초기화',
    });
    await user.click(resetTrigger);

    expect(
      screen.getByRole('dialog', { name: '로컬 장부를 초기화할까요?' }),
    ).toBeVisible();
    expect(screen.getByText('거래 내역과 불러오기 이력')).toBeVisible();
    expect(
      screen.getByText(
        '저장한 돈의 목적 설정(초기화 뒤 기본 목적 7개만 다시 만듭니다)',
      ),
    ).toBeVisible();
    expect(
      screen.getByText('원본 엑셀 파일, 샘플 파일, 앱 코드와 환경 설정은 지우지 않습니다.'),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: '로컬 장부 초기화 닫기' }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(resetLocalLedger).not.toHaveBeenCalled();
    expect(resetTrigger).toHaveFocus();

    await user.click(resetTrigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(resetLocalLedger).not.toHaveBeenCalled();
    expect(resetTrigger).toHaveFocus();
  });

  it('clears the local ledger only after the final reset confirmation', async () => {
    const user = userEvent.setup();
    const resetLocalLedger = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsPage
        settingsRepository={createRepository({
          getLocalUserSettings: vi.fn().mockResolvedValue(savedSettings),
          resetLocalLedger,
        })}
      />,
    );

    const input = await screen.findByRole('textbox', { name: '월 생활비 목표' });
    await user.click(
      screen.getByRole('button', { name: '로컬 장부 초기화' }),
    );
    await user.click(
      screen.getByRole('button', { name: '모든 로컬 데이터 초기화' }),
    );

    expect(resetLocalLedger).toHaveBeenCalledOnce();
    expect(
      await screen.findByText('이 브라우저에 저장한 장부 데이터를 초기화했어요.'),
    ).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('keeps the confirmation open and reports an error when reset storage fails', async () => {
    const user = userEvent.setup();
    const resetLocalLedger = vi.fn().mockRejectedValue(new Error('failed'));
    render(
      <SettingsPage
        settingsRepository={createRepository({
          getLocalUserSettings: vi.fn().mockResolvedValue(savedSettings),
          resetLocalLedger,
        })}
      />,
    );

    const input = await screen.findByRole('textbox', { name: '월 생활비 목표' });
    await user.click(
      screen.getByRole('button', { name: '로컬 장부 초기화' }),
    );
    await user.click(
      screen.getByRole('button', { name: '모든 로컬 데이터 초기화' }),
    );

    expect(
      await screen.findByText(
        '로컬 장부를 초기화하지 못했어요. 이 기기의 저장소를 확인한 뒤 다시 시도해 주세요.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('dialog', { name: '로컬 장부를 초기화할까요?' }),
    ).toBeVisible();
    expect(input).toHaveValue('300,000');
  });
});
