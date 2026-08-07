import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { applyCategoryRulesToLegacyXlsPreview } from '../../application/imports/apply-category-rules-to-legacy-xls-preview';
import type { PlaceSearchResult } from '../../application/places/place-search';
import { normalizeCategoryRuleDescription } from '../../domain/categories/category-rule';
import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import { LegacyXlsImportPreview } from './legacy-xls-import-preview';

const accountPreview: ImportPreview = {
  source: 'ACCOUNT_LEDGER_XLS',
  candidates: [
    {
      source: 'ACCOUNT_LEDGER_XLS',
      rowNumber: 5,
      accountTypeClassification: {
        type: 'UNKNOWN',
        source: 'ACCOUNT_RULE_ENGINE',
        reasonCode: 'no_matching_rule',
        confidence: 'REVIEW',
      },
      draft: {
        occurredOn: '2026-08-01',
        amountMinor: 15_000,
        currency: 'KRW',
        direction: 'OUTFLOW',
        type: 'UNKNOWN',
        descriptionOriginal: '가짜 식료품점',
      },
    },
  ],
  issues: [
    {
      source: 'ACCOUNT_LEDGER_XLS',
      rowNumber: 7,
      code: 'invalid_amount',
      message: '입금 또는 출금 금액을 하나만 확인할 수 있어야 합니다.',
    },
  ],
};

const expensePreview: ImportPreview = {
  source: 'CARD_USAGE_XLS',
  candidates: [
    {
      source: 'CARD_USAGE_XLS',
      rowNumber: 5,
      draft: {
        occurredOn: '2026-08-01',
        amountMinor: 15_000,
        currency: 'KRW',
        direction: 'OUTFLOW',
        type: 'EXPENSE',
        descriptionOriginal: '가짜 식료품점',
      },
    },
  ],
  issues: [],
};

const multipleExpensePreview: ImportPreview = {
  ...expensePreview,
  candidates: [
    ...expensePreview.candidates,
    {
      source: 'CARD_USAGE_XLS',
      rowNumber: 6,
      draft: {
        occurredOn: '2026-08-02',
        amountMinor: 22_000,
        currency: 'KRW',
        direction: 'OUTFLOW',
        type: 'EXPENSE',
        descriptionOriginal: '가짜 대중교통',
      },
    },
  ],
};

const paymentIntermediaryPreview: ImportPreview = {
  ...expensePreview,
  candidates: expensePreview.candidates.map((candidate) => ({
    ...candidate,
    draft: { ...candidate.draft, descriptionOriginal: 'PAYCO오더' },
  })),
};

const aliasedExpensePreview: ImportPreview = {
  ...expensePreview,
  candidates: expensePreview.candidates.map((candidate) => ({
    ...candidate,
    draft: {
      ...candidate.draft,
      descriptionOriginal: '지에쓰이십오(대전법동점)',
    },
  })),
};

const queuedExpensePreview: ImportPreview = {
  ...expensePreview,
  candidates: Array.from({ length: 5 }, (_, index) => ({
    ...expensePreview.candidates[0],
    rowNumber: index + 5,
    draft: {
      ...expensePreview.candidates[0]!.draft,
      descriptionOriginal: `가짜 대기 상점 ${index + 1}`,
    },
  })),
};

describe('LegacyXlsImportPreview', () => {
  it('shows the real file-reading state until parsing finishes', async () => {
    const user = userEvent.setup();
    let resolvePreview: (preview: ImportPreview) => void = () => {};
    const previewFile = vi.fn(
      () =>
        new Promise<ImportPreview>((resolve) => {
          resolvePreview = resolve;
        }),
    );
    render(<LegacyXlsImportPreview previewFile={previewFile} />);

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake-card.xls', {
        type: 'application/vnd.ms-excel',
      }),
    );

    expect(screen.getByText('파일을 읽고 있어요')).toBeVisible();
    expect(document.querySelector('#import')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();

    resolvePreview(expensePreview);

    expect(
      await screen.findByRole('heading', { name: '1건을 찾았어요' }),
    ).toBeVisible();
    expect(document.querySelector('#import')).toHaveAttribute('aria-busy', 'false');
  });

  it('선택한 XLS의 후보와 원본 값 없는 확인 필요 사유를 미리보기로 보여준다', async () => {
    const user = userEvent.setup();
    const previewFile = vi.fn().mockResolvedValue(accountPreview);
    render(<LegacyXlsImportPreview previewFile={previewFile} />);

    const file = new File(['fake'], 'private-account.xls', {
      type: 'application/vnd.ms-excel',
    });
    await user.upload(screen.getByLabelText('XLS 파일 선택'), file);

    expect(previewFile).toHaveBeenCalledWith(file);
    expect(screen.getByRole('heading', { name: '1건을 찾았어요' })).toBeVisible();
    expect(
      screen.getByText('새 거래 1건, 중복 가능 0건, 확인 필요 2건을 찾았습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByText('가짜 식료품점')).toBeVisible();
    expect(screen.getByText('검토 필요 · 출금')).toBeVisible();
    expect(
      screen.getByText('분류: 계좌 규칙 · 검토 필요 · 일치 규칙 없음'),
    ).toBeVisible();
    expect(
      screen.getByText('카테고리는 지출 유형에서만 지정할 수 있어요.'),
    ).toBeVisible();
    expect(
      screen.queryByLabelText('후보 1 카테고리 열기'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('−15,000원')).toBeVisible();
    expect(
      screen.getByText('7행 · 입금 또는 출금 금액을 하나만 확인할 수 있어야 합니다.'),
    ).toBeVisible();
    expect(screen.queryByText('private-account.xls')).not.toBeInTheDocument();
  });

  it('파일 읽기 실패를 일반화된 안내로 보여주고 파일명을 노출하지 않는다', async () => {
    const user = userEvent.setup();
    const previewFile = vi.fn().mockRejectedValue(new Error('raw private failure'));
    render(<LegacyXlsImportPreview previewFile={previewFile} />);

    const file = new File(['fake'], 'private-card.xls', {
      type: 'application/vnd.ms-excel',
    });
    await user.upload(screen.getByLabelText('XLS 파일 선택'), file);

    expect(screen.getByText(/파일을 읽는 중 문제가 발생했습니다/)).toBeVisible();
    expect(screen.queryByText('private-card.xls')).not.toBeInTheDocument();
    expect(screen.queryByText('raw private failure')).not.toBeInTheDocument();
  });

  it('지우기를 누르면 Preview 상태를 제거하고 저장 동작을 만들지 않는다', async () => {
    const user = userEvent.setup();
    render(<LegacyXlsImportPreview previewFile={async () => accountPreview} />);

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    await user.click(screen.getByRole('button', { name: '지우기' }));

    expect(
      screen.queryByRole('heading', { name: '1건을 찾았어요' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/이 기기에서 읽고, 확인할 거래를 차근차근 정리해요/),
    ).toBeVisible();
  });

  it('사용자가 명시적으로 확인한 후보만 로컬 저장을 요청한다', async () => {
    const user = userEvent.setup();
    const confirmPreview = vi.fn().mockResolvedValue({
      isConfirmed: true,
      batch: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        importerId: 'LEGACY_XLS',
        importerVersion: 1,
        sourceType: 'ACCOUNT_LEDGER_XLS',
        committedAt: '2026-08-05T00:00:00.000Z',
        newCount: 1,
        skippedCount: 0,
        reviewedCount: 1,
      },
      transactions: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          ...accountPreview.candidates[0].draft,
          importBatchId: '550e8400-e29b-41d4-a716-446655440000',
          importerId: 'LEGACY_XLS',
          createdAt: '2026-08-05T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
        },
      ],
    });
    render(
      <LegacyXlsImportPreview
        previewFile={async () => accountPreview}
        confirmPreview={confirmPreview}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    expect(confirmPreview).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: '1건 저장하기' }),
    );

    expect(confirmPreview).toHaveBeenCalledWith(accountPreview, { skippedCount: 0 });
    expect(await screen.findByText('1건을 이 기기에 저장했습니다.')).toBeVisible();
  });

  it('defaults a possible duplicate to excluded and allows an individual re-include', async () => {
    const user = userEvent.setup();
    const confirmPreview = vi.fn().mockResolvedValue({
      isConfirmed: true,
      batch: {},
      transactions: [],
    });
    const findPotentialDuplicates = vi.fn().mockResolvedValue([
      {
        candidateIndex: 0,
        savedTransactionIds: ['550e8400-e29b-41d4-a716-446655440099'],
        previewCandidateIndexes: [],
      },
    ]);
    render(
      <LegacyXlsImportPreview
        previewFile={async () => accountPreview}
        findPotentialDuplicates={findPotentialDuplicates}
        confirmPreview={confirmPreview}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );

    const candidateCheckbox = await screen.findByRole('checkbox', {
      name: '중복 가능 후보 1 저장',
    });
    expect(
      screen.getByText('새 거래 0건, 중복 가능 1건, 확인 필요 2건을 찾았습니다.'),
    ).toBeInTheDocument();
    expect(candidateCheckbox).not.toBeChecked();
    expect(screen.getByTestId('import-confirm-action')).toBeDisabled();

    await user.click(candidateCheckbox);
    await user.click(screen.getByTestId('import-confirm-action'));

    expect(confirmPreview).toHaveBeenCalledWith(accountPreview, { skippedCount: 0 });
  });

  it('can include all possible duplicates before confirmation', async () => {
    const user = userEvent.setup();
    const confirmPreview = vi.fn().mockResolvedValue({
      isConfirmed: false,
      code: 'nothing_to_save',
    });
    render(
      <LegacyXlsImportPreview
        previewFile={async () => accountPreview}
        findPotentialDuplicates={async () => [
          {
            candidateIndex: 0,
            savedTransactionIds: [],
            previewCandidateIndexes: [],
          },
        ]}
        confirmPreview={confirmPreview}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: '중복 가능 후보 모두 저장에 포함',
      }),
    );

    expect(screen.getByRole('checkbox', { name: '중복 가능 후보 1 저장' })).toBeChecked();
    await user.click(screen.getByTestId('import-confirm-action'));
    expect(confirmPreview).toHaveBeenCalledWith(accountPreview, { skippedCount: 0 });
  });

  it('stores a changed category and a separately confirmed future rule', async () => {
    const user = userEvent.setup();
    const confirmPreview = vi.fn().mockResolvedValue({
      isConfirmed: false,
      code: 'nothing_to_save',
    });
    render(
      <LegacyXlsImportPreview
        previewFile={async () => expensePreview}
        confirmPreview={confirmPreview}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    await user.click(await screen.findByLabelText('후보 1 카테고리 열기'));
    await user.click(
      within(
        screen.getByRole('group', { name: '후보 1 카테고리 선택' }),
      ).getByRole('button', { name: '식비·외식' }),
    );
    await user.click(screen.getByLabelText('후보 1 카테고리 규칙 저장'));
    await user.click(screen.getByTestId('import-confirm-action'));

    const [selectedPreview, options] = confirmPreview.mock.calls[0] ?? [];
    expect(selectedPreview.candidates[0].draft.categoryId).toBe('FOOD_DINING');
    expect(options).toEqual({
      skippedCount: 0,
      categoryRuleRequests: [
        expect.objectContaining({ categoryId: 'FOOD_DINING' }),
      ],
    });
  });

  it('does not allow an excluded possible duplicate to create a category rule', async () => {
    const user = userEvent.setup();
    render(
      <LegacyXlsImportPreview
        previewFile={async () => expensePreview}
        findPotentialDuplicates={async () => [
          {
            candidateIndex: 0,
            savedTransactionIds: ['550e8400-e29b-41d4-a716-446655440099'],
            previewCandidateIndexes: [],
          },
        ]}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    await user.click(await screen.findByLabelText('후보 1 카테고리 열기'));
    await user.click(
      within(
        screen.getByRole('group', { name: '후보 1 카테고리 선택' }),
      ).getByRole('button', { name: '식비·외식' }),
    );

    expect(screen.getByLabelText('후보 1 카테고리 규칙 저장')).toBeDisabled();
  });

  it('opens one compact picker at a time and clears a category separately from rule consent', async () => {
    const user = userEvent.setup();
    render(
      <LegacyXlsImportPreview previewFile={async () => multipleExpensePreview} />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    await user.click(await screen.findByLabelText('후보 1 카테고리 열기'));
    expect(
      screen.getByRole('group', { name: '후보 1 카테고리 선택' }),
    ).toBeVisible();

    await user.click(screen.getByLabelText('후보 2 카테고리 열기'));
    expect(
      screen.queryByRole('group', { name: '후보 1 카테고리 선택' }),
    ).not.toBeInTheDocument();
    const secondPicker = screen.getByRole('group', {
      name: '후보 2 카테고리 선택',
    });
    await user.click(within(secondPicker).getByRole('button', { name: '교통' }));

    expect(screen.getByLabelText('후보 2 카테고리 규칙 저장')).toBeEnabled();
    await user.click(screen.getByLabelText('후보 2 카테고리 열기'));
    await user.click(
      within(
        screen.getByRole('group', { name: '후보 2 카테고리 선택' }),
      ).getByRole('button', { name: '미분류' }),
    );
    expect(screen.getByLabelText('후보 2 카테고리 규칙 저장')).toBeDisabled();
  });

  it('closes the category bottom sheet with Escape and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(<LegacyXlsImportPreview previewFile={async () => expensePreview} />);

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    const trigger = await screen.findByLabelText('후보 1 카테고리 열기');
    await user.click(trigger);

    const picker = screen.getByRole('group', {
      name: '후보 1 카테고리 선택',
    });
    expect(
      screen.getByRole('dialog', { name: '어디에 사용하셨나요?' }),
    ).toBeVisible();
    expect(picker).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('group', { name: '후보 1 카테고리 선택' }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('automatically sends an expense description to Kakao after file upload', async () => {
    const user = userEvent.setup();
    const searchPlaces = vi.fn().mockResolvedValue([
      {
        id: 'place-1',
        placeName: '가짜 식료품점',
        categoryName: '음식점 > 카페 > 커피전문점',
        categoryGroupCode: '',
        categoryGroupName: '',
        addressName: 'Fabricated parcel address',
        roadAddressName: 'Fabricated road address',
        x: '127.0000',
        y: '37.0000',
      },
    ]);
    render(
      <LegacyXlsImportPreview
        previewFile={async () => expensePreview}
        searchPlaces={searchPlaces}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    expect(
      screen.getByText('파일 업로드 시 이 거래 설명을 Kakao로 자동 분석하며, 결과는 저장하지 않아요.'),
    ).toBeVisible();
    expect(searchPlaces).toHaveBeenCalledWith('가짜 식료품점');
    expect(
      await screen.findByText(
        '가짜 식료품점 · 음식점 > 카페 > 커피전문점 · Fabricated road address',
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/가짜 식료품점 · 음식점 > 카페 > 커피전문점 → 카페 · KAKAO_LOCAL · HIGH/),
    ).toBeVisible();
  });

  it('uses a canonical fallback query and shows the in-memory resolution trace', async () => {
    const user = userEvent.setup();
    const searchPlaces = vi.fn(async (query: string) =>
      query === 'GS25 대전법동점'
        ? [
            {
              id: 'canonical-place',
              placeName: 'GS25 대전법동점',
              categoryName: '가정,생활 > 편의점 > GS25',
              categoryGroupCode: 'CS2',
              categoryGroupName: '편의점',
              addressName: 'Fabricated parcel address',
              roadAddressName: 'Fabricated road address',
              x: '127.0000',
              y: '37.0000',
            },
          ]
        : [],
    );
    render(
      <LegacyXlsImportPreview
        previewFile={async () => aliasedExpensePreview}
        searchPlaces={searchPlaces}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );

    expect(
      await screen.findByText(
        /GS25 대전법동점 · 가정,생활 > 편의점 > GS25 → 편의점 · KAKAO_LOCAL · HIGH/,
      ),
    ).toBeVisible();
    expect(searchPlaces.mock.calls.map(([query]) => query)).toEqual([
      '지에쓰이십오(대전법동점)',
      '지에쓰이십오 대전법동점',
      'GS25 대전법동점',
    ]);

    await user.click(screen.getByText('상세 분석 과정 (개발자용)'));
    expect(screen.getByText('해석: ALIAS · HIGH')).toBeVisible();
    expect(
      screen.getByText('Alias: 지에쓰이십오 → GS25 대전법동점'),
    ).toBeVisible();
    expect(
      screen.getByText('Canonical: GS25 대전법동점'),
    ).toBeVisible();
    expect(
      screen.getByText('내부 카테고리: 편의점'),
    ).toBeVisible();
  });

  it('shows pending Kakao analysis progress until the place search completes', async () => {
    const user = userEvent.setup();
    let resolveSearch: (value: readonly PlaceSearchResult[]) => void = () => {};
    const searchPlaces = vi.fn(
      () =>
        new Promise<readonly PlaceSearchResult[]>((resolve) => {
          resolveSearch = resolve;
        }),
    );
    render(
      <LegacyXlsImportPreview
        previewFile={async () => expensePreview}
        searchPlaces={searchPlaces}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );

    expect(await screen.findByText('Kakao 장소를 분석하고 있어요')).toBeVisible();
    expect(
      screen.getByText('1건을 처리 중입니다. 결과가 도착하면 자동으로 표시됩니다.'),
    ).toBeVisible();

    resolveSearch([]);

    expect(
      await screen.findByText('일치하는 장소가 없어요. 결과는 저장하지 않습니다.'),
    ).toBeVisible();
    expect(screen.queryByText('Kakao 장소를 분석하고 있어요')).not.toBeInTheDocument();
  });

  it('limits simultaneous candidate analyses while queued work remains visible', async () => {
    const user = userEvent.setup();
    const pendingResolvers: Array<
      (value: readonly PlaceSearchResult[]) => void
    > = [];
    const searchPlaces = vi.fn(
      () =>
        new Promise<readonly PlaceSearchResult[]>((resolve) => {
          pendingResolvers.push(resolve);
        }),
    );
    render(
      <LegacyXlsImportPreview
        previewFile={async () => queuedExpensePreview}
        searchPlaces={searchPlaces}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );

    await waitFor(() => expect(searchPlaces).toHaveBeenCalledTimes(3));
    expect(screen.getByText('Kakao 장소를 분석하고 있어요')).toBeVisible();
    pendingResolvers[0]?.([]);
    await waitFor(() => expect(searchPlaces).toHaveBeenCalledTimes(4));
  });

  it('keeps a user-rule category ahead of Kakao and does not send it for lookup', async () => {
    const user = userEvent.setup();
    const searchPlaces = vi.fn();
    render(
      <LegacyXlsImportPreview
        previewFile={async () => aliasedExpensePreview}
        applyCategoryRules={(preview) =>
          applyCategoryRulesToLegacyXlsPreview(preview, {
            listCategoryRules: async () => [
              {
                matchDescriptionNormalized: normalizeCategoryRuleDescription(
                  '지에쓰이십오 대전법동점',
                ),
                categoryId: 'CONVENIENCE',
                createdAt: '2026-08-07T00:00:00.000Z',
                updatedAt: '2026-08-07T00:00:00.000Z',
              },
            ],
          })
        }
        searchPlaces={searchPlaces}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );

    expect(searchPlaces).not.toHaveBeenCalled();
    expect(
      await screen.findByText('사용자 규칙 → 편의점 · USER_RULE · HIGH'),
    ).toBeVisible();
    expect(
      screen.queryByText('상세 분석 과정 (개발자용)'),
    ).not.toBeInTheDocument();
  });

  it('does not send known payment intermediaries to Kakao and keeps them in review', async () => {
    const user = userEvent.setup();
    const searchPlaces = vi.fn();
    render(
      <LegacyXlsImportPreview
        previewFile={async () => paymentIntermediaryPreview}
        searchPlaces={searchPlaces}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );

    expect(searchPlaces).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/결제 중개자 표식이라 Kakao 자동 분석에서 제외했습니다/),
    ).toBeVisible();
  });

  it('ignores a stale Kakao result after the active Preview is cleared', async () => {
    const user = userEvent.setup();
    let resolveSearch: (value: readonly PlaceSearchResult[]) => void = () => {};
    const searchPlaces = vi.fn(
      () =>
        new Promise<readonly PlaceSearchResult[]>((resolve) => {
          resolveSearch = resolve;
        }),
    );
    render(
      <LegacyXlsImportPreview
        previewFile={async () => aliasedExpensePreview}
        searchPlaces={searchPlaces}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    expect(await screen.findByText('Kakao 장소를 분석하고 있어요')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '지우기' }));
    resolveSearch([]);

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: '1건을 찾았어요' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Kakao 장소를 분석하고 있어요'),
      ).not.toBeInTheDocument();
    });
    expect(searchPlaces).toHaveBeenCalledTimes(1);
  });

  it('does not let an older upload overwrite a newer candidate at the same index', async () => {
    const user = userEvent.setup();
    let resolveOldSearch: (value: readonly PlaceSearchResult[]) => void = () => {};
    const previewFile = vi
      .fn()
      .mockResolvedValueOnce(aliasedExpensePreview)
      .mockResolvedValueOnce(expensePreview);
    const searchPlaces = vi.fn((query: string) => {
      if (query === '지에쓰이십오(대전법동점)') {
        return new Promise<readonly PlaceSearchResult[]>((resolve) => {
          resolveOldSearch = resolve;
        });
      }

      return Promise.resolve(
        query === '가짜 식료품점'
          ? [
              {
                id: 'new-place',
                placeName: '가짜 식료품점',
                categoryName: '음식점 > 카페 > 커피전문점',
                categoryGroupCode: 'CE7',
                categoryGroupName: '카페',
                addressName: 'Fabricated new parcel address',
                roadAddressName: 'Fabricated new road address',
                x: '127.0000',
                y: '37.0000',
              },
            ]
          : [],
      );
    });
    render(
      <LegacyXlsImportPreview
        previewFile={previewFile}
        searchPlaces={searchPlaces}
      />,
    );
    const input = screen.getByLabelText('XLS 파일 선택');

    await user.upload(
      input,
      new File(['first'], 'first.xls', {
        type: 'application/vnd.ms-excel',
      }),
    );
    expect(await screen.findByText('Kakao 장소를 분석하고 있어요')).toBeVisible();

    await user.upload(
      input,
      new File(['second'], 'second.xls', {
        type: 'application/vnd.ms-excel',
      }),
    );
    expect(
      await screen.findByText(
        /가짜 식료품점 · 음식점 > 카페 > 커피전문점 → 카페 · KAKAO_LOCAL · HIGH/,
      ),
    ).toBeVisible();

    resolveOldSearch([
      {
        id: 'old-place',
        placeName: 'GS25 대전법동점',
        categoryName: '가정,생활 > 편의점 > GS25',
        categoryGroupCode: 'CS2',
        categoryGroupName: '편의점',
        addressName: 'Fabricated old parcel address',
        roadAddressName: 'Fabricated old road address',
        x: '127.0000',
        y: '37.0000',
      },
    ]);

    await waitFor(() => {
      expect(screen.queryByText('GS25 대전법동점')).not.toBeInTheDocument();
      expect(screen.getByText('가짜 식료품점')).toBeVisible();
    });
  });
});
