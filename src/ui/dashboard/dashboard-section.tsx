import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CATEGORY_IDS,
  type CategoryId,
} from '../../domain/categories/category';
import { getCategoryPresentation } from '../../domain/categories/category-presentation';
import { calculateMonthlyLivingExpenseGoalProgress } from '../../domain/settings/monthly-living-expense-goal-progress';
import type { LocalUserSettings } from '../../domain/settings/local-user-settings';
import { saveManualBudgetSettlement } from '../../application/ledger/save-manual-budget-settlement';
import { updateTransactionDetails } from '../../application/ledger/update-transaction-details';
import type { BudgetSettlement } from '../../domain/transactions/budget-settlement';
import { calculateLivingExpenseSummary } from '../../domain/transactions/living-expense';
import { isReviewNeededTransaction } from '../../domain/transactions/review-needed';
import {
  getTransactionDateRange,
  type TransactionPeriodPreset,
} from '../../domain/transactions/transaction-period';
import type { CalendarDate } from '../../domain/transactions/calendar-date';
import type { Transaction } from '../../domain/transactions/transaction';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';
import { BrowserLedgerRepository } from '../../infrastructure/storage/browser-ledger-repository';
import { formatWon } from '../../shared/format/currency';
import {
  dashboardMockSummary,
  dashboardMockTransactions,
} from './dashboard-fixtures';
import './dashboard-refresh.css';

type DashboardMode = 'LOCAL' | 'MOCK';
type DashboardPage = 'HOME' | 'TRANSACTIONS';
type TransactionFilter = 'ALL' | 'EXPENSE' | 'INCOME' | 'REVIEW';

export type LocalLedgerRepository = Pick<
  BrowserLedgerRepository,
  | 'listTransactionsInRange'
  | 'listAllTransactions'
  | 'getTransactionsByIds'
  | 'listBudgetSettlements'
  | 'saveBudgetSettlement'
  | 'removeBudgetSettlement'
  | 'replaceTransaction'
  | 'getLocalUserSettings'
>;

type DashboardSectionProps = Readonly<{
  ledgerRepository: LocalLedgerRepository;
  page?: DashboardPage;
}>;

type SettlementNotice = Readonly<{
  tone: 'success' | 'error';
  message: string;
}>;

type TransactionEditDraft = Readonly<{
  transactionId: string;
  categoryId: CategoryId | undefined;
  memo: string;
}>;

type WeeklySpendingDay = Readonly<{
  date: CalendarDate;
  weekdayLabel: string;
  amountMinor: number;
}>;

const TRANSACTION_FILTERS: readonly Readonly<{
  id: TransactionFilter;
  label: string;
}>[] = [
  { id: 'ALL', label: '전체' },
  { id: 'EXPENSE', label: '지출' },
  { id: 'INCOME', label: '수입' },
  { id: 'REVIEW', label: '확인 필요' },
];

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const HOME_RECENT_TRANSACTION_LIMIT = 5;

function getTodayInSeoul(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${valueByType.get('year')}-${valueByType.get('month')}-${valueByType.get('day')}`;
}

function createLocalId(): string {
  return crypto.randomUUID();
}

function currentUtcIsoInstant(): UtcIsoInstant {
  return new Date().toISOString() as UtcIsoInstant;
}

function enumerateCalendarDates(
  startOn: CalendarDate,
  endOn: CalendarDate,
): readonly CalendarDate[] {
  const dates: CalendarDate[] = [];
  const cursor = new Date(`${startOn}T00:00:00.000Z`);
  const end = new Date(`${endOn}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10) as CalendarDate);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function getWeekdayLabel(date: CalendarDate): string {
  return WEEKDAY_LABELS[new Date(`${date}T00:00:00.000Z`).getUTCDay()] ?? '';
}

function filterTransactions(
  transactions: readonly Transaction[],
  filter: TransactionFilter,
): readonly Transaction[] {
  if (filter === 'EXPENSE') {
    return transactions.filter((transaction) => transaction.direction === 'OUTFLOW');
  }

  if (filter === 'INCOME') {
    return transactions.filter((transaction) => transaction.direction === 'INFLOW');
  }

  if (filter === 'REVIEW') {
    return transactions.filter(isReviewNeededTransaction);
  }

  return transactions;
}

function sortTransactionsByMostRecent(
  transactions: readonly Transaction[],
): readonly Transaction[] {
  return [...transactions].sort(
    (left, right) =>
      right.occurredOn.localeCompare(left.occurredOn) ||
      right.createdAt.localeCompare(left.createdAt),
  );
}

function getTransactionTypeLabel(type: Transaction['type']): string {
  const labels: Readonly<Record<Transaction['type'], string>> = {
    EXPENSE: '지출',
    INCOME: '수입',
    TRANSFER: '이체',
    SELF_TRANSFER: '내 계좌 이체',
    CARD_PAYMENT: '카드대금',
    SAVING: '저축',
    INVESTMENT: '투자',
    LOAN_PAYMENT: '대출 상환',
    REWARD: '리워드',
    REFUND: '환불',
    UNKNOWN: '확인 필요',
  };

  return labels[type];
}

function getSettlementErrorMessage(code: Exclude<
  Awaited<ReturnType<typeof saveManualBudgetSettlement>>,
  { isSaved: true }
>['code']): string {
  const messages = {
    invalid_settlement: '원결제 1건과 정산 입금 1건 이상을 다시 선택해 주세요.',
    missing_transaction: '선택한 거래를 찾을 수 없습니다. 목록을 새로 확인해 주세요.',
    payer_must_be_outflow: '원결제는 출금 거래만 선택할 수 있습니다.',
    reimbursements_must_be_inflow: '정산금은 입금 거래만 선택할 수 있습니다.',
    transaction_already_linked: '이미 다른 정산에 연결된 거래가 있습니다.',
    storage_failed: '정산을 저장하지 못했습니다. 기존 거래는 변경되지 않았습니다.',
  } as const;

  return messages[code];
}

function getSettlementSummary(
  settlement: BudgetSettlement,
  transactions: readonly Transaction[],
): string {
  const transactionById = new Map(
    transactions.map((transaction) => [transaction.id, transaction]),
  );
  const payer = transactionById.get(settlement.payerOutflowTransactionId);

  return payer === undefined
    ? '연결한 원결제'
    : `${payer.occurredOn} · ${payer.descriptionOriginal}`;
}

type HomeDashboardProps = Readonly<{
  livingExpenseAmountMinor: number;
  monthlyGoalProgress: ReturnType<
    typeof calculateMonthlyLivingExpenseGoalProgress
  >;
  reviewNeededCount: number;
  weeklySpending: readonly WeeklySpendingDay[];
  recentTransactions: readonly Transaction[];
  isLoading: boolean;
  loadError: boolean;
  onRetry: () => void;
}>;

function HomeDashboard({
  livingExpenseAmountMinor,
  monthlyGoalProgress,
  reviewNeededCount,
  weeklySpending,
  recentTransactions,
  isLoading,
  loadError,
  onRetry,
}: HomeDashboardProps) {
  if (isLoading) {
    return (
      <div className="home-dashboard-state" role="status" aria-live="polite">
        <span className="home-dashboard-spinner" aria-hidden="true" />
        <strong>이번 달 장부를 불러오는 중이에요</strong>
        <p>이 기기에 저장한 거래와 생활비 목표를 확인하고 있습니다.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="home-dashboard-state home-dashboard-state--error" role="alert">
        <strong>홈 요약을 불러오지 못했어요</strong>
        <p>로컬 저장소를 다시 확인해 주세요. 개인정보는 외부로 전송되지 않았습니다.</p>
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    );
  }

  const weeklyMaximum = Math.max(
    0,
    ...weeklySpending.map((day) => day.amountMinor),
  );
  const goalUsagePercent =
    monthlyGoalProgress === undefined
      ? undefined
      : Math.min(
          100,
          Math.round(
            (monthlyGoalProgress.usedAmountMinor /
              monthlyGoalProgress.goalAmountMinor) *
              100,
          ),
        );

  return (
    <div className="home-dashboard">
      <section className="home-spending-hero" aria-labelledby="home-spending-title">
        <p id="home-spending-title">이번 달 생활비</p>
        <strong>{formatWon(livingExpenseAmountMinor)}</strong>
        <small>공동결제 정산을 반영한 실제 순지출이에요.</small>
      </section>

      {monthlyGoalProgress === undefined ? (
        <section className="home-goal-card home-goal-card--empty" aria-labelledby="home-goal-title">
          <div>
            <h3 id="home-goal-title">월 생활비 목표가 아직 없어요</h3>
            <p>설정에서 목표를 입력하면 이번 달 남은 생활비를 보여드릴게요.</p>
          </div>
          <a href="/settings">생활비 목표 설정하기</a>
        </section>
      ) : (
        <section
          className={
            monthlyGoalProgress.status === 'EXCEEDED'
              ? 'home-goal-card home-goal-card--exceeded'
              : 'home-goal-card'
          }
          aria-labelledby="home-goal-title"
        >
          <div className="home-goal-heading">
            <div>
              <h3 id="home-goal-title">생활비 목표</h3>
              <p>
                {monthlyGoalProgress.status === 'EXCEEDED'
                  ? `${formatWon(monthlyGoalProgress.differenceAmountMinor)} 초과했어요`
                  : `${formatWon(monthlyGoalProgress.differenceAmountMinor)} 남았어요`}
              </p>
            </div>
            <span>{goalUsagePercent}% 사용</span>
          </div>
          <div
            className="home-goal-progress"
            role="progressbar"
            aria-label="월 생활비 목표 사용률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={goalUsagePercent}
          >
            <span style={{ width: `${goalUsagePercent}%` }} />
          </div>
          <small>
            {formatWon(monthlyGoalProgress.usedAmountMinor)} /{' '}
            {formatWon(monthlyGoalProgress.goalAmountMinor)}
          </small>
        </section>
      )}

      <section
        className={
          reviewNeededCount > 0
            ? 'home-review-card home-review-card--needed'
            : 'home-review-card'
        }
        aria-labelledby="home-review-title"
      >
        <span className="home-review-icon" aria-hidden="true">
          {reviewNeededCount > 0 ? '!' : '✓'}
        </span>
        <div>
          <h3 id="home-review-title">
            {reviewNeededCount > 0
              ? `분류가 필요한 거래 ${reviewNeededCount}건`
              : '분류가 필요한 거래가 없어요'}
          </h3>
          <p>
            {reviewNeededCount > 0
              ? '한 건씩 빠르게 카테고리를 정리할 수 있어요.'
              : '저장한 거래의 카테고리가 모두 정리되어 있어요.'}
          </p>
          {reviewNeededCount > 0 ? (
            <a className="home-review-action" href="/review">
              분류 시작하기
            </a>
          ) : null}
        </div>
      </section>

      <section className="home-weekly-card" aria-labelledby="home-weekly-title">
        <div className="home-card-heading">
          <div>
            <p className="panel-kicker">최근 일주일</p>
            <h3 id="home-weekly-title">최근 7일 생활비</h3>
          </div>
        </div>
        <ul className="home-weekly-bars" aria-label="최근 7일 생활비 막대 그래프">
          {weeklySpending.map((day) => {
            const heightPercent =
              weeklyMaximum === 0
                ? 0
                : Math.round((day.amountMinor / weeklyMaximum) * 100);

            return (
              <li
                key={day.date}
                aria-label={`${day.date} 생활비 ${formatWon(day.amountMinor)}`}
              >
                <span className="home-weekly-bar" aria-hidden="true">
                  <i style={{ height: `${heightPercent}%` }} />
                </span>
                <span>{day.weekdayLabel}</span>
                <small>{Number(day.date.slice(8, 10))}</small>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="home-recent-card" aria-labelledby="home-recent-title">
        <div className="home-card-heading">
          <div>
            <p className="panel-kicker">요즘 내역</p>
            <h3 id="home-recent-title">최근 거래</h3>
          </div>
          <span>{recentTransactions.length}건</span>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="home-recent-empty">
            <strong>이번 달 거래가 아직 없어요</strong>
            <p>금융 데이터를 불러오면 최근 거래를 여기에 정리해 드릴게요.</p>
          </div>
        ) : (
          <ul className="transaction-list home-transaction-list">
            {recentTransactions.map((transaction) => {
              const category = getCategoryPresentation(transaction.categoryId);

              return (
                <li key={transaction.id}>
                  <span className="transaction-mark" aria-hidden="true">
                    {category.emoji}
                  </span>
                  <span className="transaction-copy">
                    <strong>{transaction.descriptionOriginal}</strong>
                    <small>
                      {transaction.occurredOn} · {category.label}
                      {transaction.paymentInstrumentLabel === undefined
                        ? ''
                        : ` · ${transaction.paymentInstrumentLabel}`}
                    </small>
                  </span>
                  <strong
                    className={
                      transaction.direction === 'INFLOW'
                        ? 'amount amount--income'
                        : 'amount'
                    }
                  >
                    {transaction.direction === 'INFLOW' ? '+' : '−'}
                    {formatWon(transaction.amountMinor)}
                  </strong>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function DashboardSection({
  ledgerRepository,
  page = 'TRANSACTIONS',
}: DashboardSectionProps) {
  const [mode, setMode] = useState<DashboardMode>('LOCAL');
  const [preset, setPreset] = useState<TransactionPeriodPreset>('MONTH');
  const [anchorOn, setAnchorOn] = useState(getTodayInSeoul);
  const [customStartOn, setCustomStartOn] = useState(getTodayInSeoul);
  const [customEndOn, setCustomEndOn] = useState(getTodayInSeoul);
  const [transactions, setTransactions] = useState<readonly Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<readonly Transaction[]>(
    [],
  );
  const [settlements, setSettlements] = useState<readonly BudgetSettlement[]>([]);
  const [localUserSettings, setLocalUserSettings] = useState<
    LocalUserSettings | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [payerTransactionId, setPayerTransactionId] = useState('');
  const [reimbursementTransactionIds, setReimbursementTransactionIds] = useState<
    readonly string[]
  >([]);
  const [settlementNotice, setSettlementNotice] = useState<SettlementNotice | null>(
    null,
  );
  const [transactionEditDraft, setTransactionEditDraft] = useState<
    TransactionEditDraft | null
  >(null);
  const [isSavingTransactionEdit, setIsSavingTransactionEdit] = useState(false);
  const [transactionEditError, setTransactionEditError] = useState<string | null>(
    null,
  );
  const [transactionFilter, setTransactionFilter] =
    useState<TransactionFilter>('ALL');
  const transactionEditTriggerRef = useRef<HTMLButtonElement | null>(null);
  const transactionEditCategoryRef = useRef<HTMLSelectElement | null>(null);
  const transactionEditDialogRef = useRef<HTMLDivElement | null>(null);
  const activeTransactionEditId = transactionEditDraft?.transactionId;
  const isMock = page === 'TRANSACTIONS' && mode === 'MOCK';
  const rangeResult = useMemo(
    () => {
      if (page === 'HOME') {
        return getTransactionDateRange('MONTH', anchorOn);
      }

      return getTransactionDateRange(preset, anchorOn, {
        startOn: customStartOn,
        endOn: customEndOn,
      });
    },
    [anchorOn, customEndOn, customStartOn, page, preset],
  );

  const requestReload = useCallback(() => {
    setReloadVersion((version) => version + 1);
  }, []);

  const closeTransactionEdit = useCallback(() => {
    const trigger = transactionEditTriggerRef.current;

    setTransactionEditDraft(null);
    setTransactionEditError(null);
    window.setTimeout(() => {
      if (trigger?.isConnected) {
        trigger.focus();
      }
    }, 0);
  }, []);

  useEffect(() => {
    if (activeTransactionEditId === undefined) {
      return undefined;
    }

    transactionEditCategoryRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingTransactionEdit) {
        event.preventDefault();
        closeTransactionEdit();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = Array.from(
          transactionEditDialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements.at(-1);

        if (
          event.shiftKey &&
          firstFocusable !== undefined &&
          document.activeElement === firstFocusable
        ) {
          event.preventDefault();
          lastFocusable?.focus();
        } else if (
          !event.shiftKey &&
          lastFocusable !== undefined &&
          document.activeElement === lastFocusable
        ) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [
    closeTransactionEdit,
    activeTransactionEditId,
    isSavingTransactionEdit,
  ]);

  useEffect(() => {
    if (!rangeResult.isValid) {
      return undefined;
    }

    let isCurrent = true;
    setIsLoading(true);
    setLoadError(false);

    void Promise.all([
      ledgerRepository.listTransactionsInRange(rangeResult.value),
      ledgerRepository.listAllTransactions(),
      ledgerRepository.listBudgetSettlements(),
      ledgerRepository.getLocalUserSettings(),
    ])
      .then(
        ([
          rangeTransactions,
          nextAllTransactions,
          nextSettlements,
          nextLocalUserSettings,
        ]) => {
          if (!isCurrent) {
            return;
          }
          setTransactions(rangeTransactions);
          setAllTransactions(nextAllTransactions);
          setSettlements(nextSettlements);
          setLocalUserSettings(nextLocalUserSettings);
        },
      )
      .catch(() => {
        if (!isCurrent) {
          return;
        }
        setTransactions([]);
        setAllTransactions([]);
        setSettlements([]);
        setLocalUserSettings(undefined);
        setLoadError(true);
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [ledgerRepository, rangeResult, reloadVersion]);

  const livingExpenseSummary =
    rangeResult.isValid
      ? calculateLivingExpenseSummary(
          allTransactions,
          settlements,
          rangeResult.value,
        )
      : {
          unlinkedExpenseAmountMinor: 0,
          sharedPaymentExpenseAmountMinor: 0,
          totalAmountMinor: 0,
          sharedPaymentCount: 0,
        };
  const monthlyGoalProgress =
    !isMock &&
    (page === 'HOME' || preset === 'MONTH') &&
    rangeResult.isValid
      ? calculateMonthlyLivingExpenseGoalProgress(
          localUserSettings,
          livingExpenseSummary.totalAmountMinor,
        )
      : undefined;
  const totalIncome = transactions
    .filter((transaction) => transaction.direction === 'INFLOW')
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
  const totalOutflow = transactions
    .filter((transaction) => transaction.direction === 'OUTFLOW')
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, transactionFilter),
    [transactionFilter, transactions],
  );
  const editingTransaction =
    transactionEditDraft === null
      ? undefined
      : transactions.find(
          (transaction) => transaction.id === transactionEditDraft.transactionId,
        );
  const reviewNeededCount = allTransactions.filter(isReviewNeededTransaction).length;
  const recentTransactions = useMemo(
    () =>
      sortTransactionsByMostRecent(transactions).slice(
        0,
        HOME_RECENT_TRANSACTION_LIMIT,
      ),
    [transactions],
  );
  const weeklySpending = useMemo<readonly WeeklySpendingDay[]>(() => {
    const weekRangeResult = getTransactionDateRange('WEEK', anchorOn);

    if (!weekRangeResult.isValid) {
      return [];
    }

    return enumerateCalendarDates(
      weekRangeResult.value.startOn,
      weekRangeResult.value.endOn,
    ).map((date) => ({
      date,
      weekdayLabel: getWeekdayLabel(date),
      amountMinor: calculateLivingExpenseSummary(
        allTransactions,
        settlements,
        { startOn: date, endOn: date },
      ).totalAmountMinor,
    }));
  }, [allTransactions, anchorOn, settlements]);
  const linkedTransactionIds = new Set(
    settlements.flatMap((settlement) => [
      settlement.payerOutflowTransactionId,
      ...settlement.reimbursementInflowTransactionIds,
    ]),
  );
  const outflowCandidates = allTransactions.filter(
    (transaction) =>
      transaction.direction === 'OUTFLOW' && !linkedTransactionIds.has(transaction.id),
  );
  const inflowCandidates = allTransactions.filter(
    (transaction) =>
      transaction.direction === 'INFLOW' && !linkedTransactionIds.has(transaction.id),
  );

  const handleReimbursementChange = (transactionId: string, checked: boolean) => {
    setReimbursementTransactionIds((current) =>
      checked
        ? [...current, transactionId]
        : current.filter((item) => item !== transactionId),
    );
  };

  const handleSaveSettlement = async () => {
    const now = currentUtcIsoInstant();
    const result = await saveManualBudgetSettlement(
      {
        id: createLocalId(),
        payerOutflowTransactionId: payerTransactionId,
        reimbursementInflowTransactionIds: reimbursementTransactionIds,
        createdAt: now,
        updatedAt: now,
      },
      ledgerRepository,
    );

    if (!result.isSaved) {
      setSettlementNotice({
        tone: 'error',
        message: getSettlementErrorMessage(result.code),
      });
      return;
    }

    setPayerTransactionId('');
    setReimbursementTransactionIds([]);
    setSettlementNotice({ tone: 'success', message: '공동결제 정산을 연결했습니다.' });
    requestReload();
  };

  const handleRemoveSettlement = async (settlementId: string) => {
    try {
      await ledgerRepository.removeBudgetSettlement(settlementId);
      setSettlementNotice({ tone: 'success', message: '공동결제 정산 연결을 해제했습니다.' });
      requestReload();
    } catch {
      setSettlementNotice({
        tone: 'error',
        message: '정산 연결을 해제하지 못했습니다. 기존 거래는 변경되지 않았습니다.',
      });
    }
  };

  const startTransactionEdit = (
    transaction: Transaction,
    trigger: HTMLButtonElement,
  ) => {
    transactionEditTriggerRef.current = trigger;
    setTransactionEditDraft({
      transactionId: transaction.id,
      categoryId: transaction.categoryId,
      memo: transaction.memo ?? '',
    });
    setTransactionEditError(null);
  };

  const handleTransactionEditSave = async () => {
    if (transactionEditDraft === null) {
      return;
    }

    setIsSavingTransactionEdit(true);
    setTransactionEditError(null);
    const memo = transactionEditDraft.memo.trim();
    const result = await updateTransactionDetails(
      {
        transactionId: transactionEditDraft.transactionId,
        categoryId: transactionEditDraft.categoryId,
        memo: memo.length === 0 ? undefined : memo,
        updatedAt: currentUtcIsoInstant(),
      },
      ledgerRepository,
    );
    setIsSavingTransactionEdit(false);

    if (!result.isUpdated) {
      setTransactionEditError(
        '거래 내용을 저장하지 못했습니다. 기존 거래는 변경되지 않았습니다.',
      );
      return;
    }

    setTransactions((current) =>
      current.map((transaction) =>
        transaction.id === result.transaction.id ? result.transaction : transaction,
      ),
    );
    setAllTransactions((current) =>
      current.map((transaction) =>
        transaction.id === result.transaction.id ? result.transaction : transaction,
      ),
    );
    closeTransactionEdit();
  };

  return (
    <section
      className={`ledger-section ledger-section--${page.toLowerCase()}`}
      id="ledger"
      aria-labelledby="ledger-title"
    >
      <div className="section-heading ledger-heading">
        <div>
          <p className="eyebrow">
            {page === 'HOME' ? '이번 달 한눈에' : '내 장부'}
          </p>
          <h2 id="ledger-title">
            {page === 'HOME'
              ? '이번 달 생활비를 한눈에 확인하세요'
              : '저장한 거래를 기간별로 확인하세요'}
          </h2>
          <p>
            {page === 'HOME'
              ? '이 기기에 저장한 거래만으로 생활비와 목표 현황을 정리합니다.'
              : 'XLS를 확인한 뒤 저장한 거래만 이 기기에서 조회합니다. 원본 파일과 파일명은 저장하지 않습니다.'}
          </p>
        </div>

        {page === 'TRANSACTIONS' ? (
          <div className="view-switch" aria-label="장부 보기 선택">
            <button
              type="button"
              className={!isMock ? 'is-active' : undefined}
              aria-pressed={!isMock}
              onClick={() => setMode('LOCAL')}
            >
              내 거래
            </button>
            <button
              type="button"
              className={isMock ? 'is-active' : undefined}
              aria-pressed={isMock}
              onClick={() => setMode('MOCK')}
            >
              예시 보기
            </button>
          </div>
        ) : null}
      </div>

      {isMock ? (
        <div className="mock-notice" role="status">
          <span aria-hidden="true">M</span>
          예시 데이터 · 아래 금액과 거래는 화면 확인을 위한 가짜 값입니다.
        </div>
      ) : null}

      {!isMock && page === 'TRANSACTIONS' ? (
        <section className="period-controls" aria-label="저장 거래 기간 선택">
          <div className="period-preset-buttons" role="group" aria-label="기간 빠른 선택">
            {([
              ['DAY', '하루'],
              ['WEEK', '최근 1주'],
              ['MONTH', '이번 달'],
              ['CUSTOM', '직접 선택'],
            ] as const).map(([nextPreset, label]) => (
              <button
                className={preset === nextPreset ? 'is-active' : undefined}
                type="button"
                aria-pressed={preset === nextPreset}
                key={nextPreset}
                onClick={() => setPreset(nextPreset)}
              >
                {label}
              </button>
            ))}
          </div>

          {preset === 'CUSTOM' ? (
            <div className="period-date-inputs">
              <label>
                기간 시작
                <input
                  type="date"
                  value={customStartOn}
                  onChange={(event) => setCustomStartOn(event.target.value)}
                />
              </label>
              <label>
                기간 종료
                <input
                  type="date"
                  value={customEndOn}
                  onChange={(event) => setCustomEndOn(event.target.value)}
                />
              </label>
            </div>
          ) : (
            <label className="period-anchor-input">
              기준일
              <input
                type="date"
                value={anchorOn}
                onChange={(event) => setAnchorOn(event.target.value)}
              />
            </label>
          )}

          {rangeResult.isValid ? (
            <p className="period-range-note">
              조회 범위 · {rangeResult.value.startOn} ~ {rangeResult.value.endOn} (양끝 포함)
            </p>
          ) : (
            <p className="period-range-error" role="alert">
              시작일은 종료일보다 늦을 수 없습니다. 날짜를 다시 선택해 주세요.
            </p>
          )}
        </section>
      ) : null}

      <div className="ledger-main">
        {page === 'HOME' && !isMock ? (
          <HomeDashboard
            livingExpenseAmountMinor={livingExpenseSummary.totalAmountMinor}
            monthlyGoalProgress={monthlyGoalProgress}
            reviewNeededCount={reviewNeededCount}
            weeklySpending={weeklySpending}
            recentTransactions={recentTransactions}
            isLoading={isLoading}
            loadError={loadError}
            onRetry={requestReload}
          />
        ) : (
          <>
          <div className="summary-grid" aria-label="기간 요약">
            {isMock
              ? dashboardMockSummary.map((item) => (
                  <article
                    className={`summary-card summary-card--${item.tone}`}
                    key={item.label}
                  >
                    <span>{item.label}</span>
                    <strong>{formatWon(item.valueWon)}</strong>
                    <small>{item.detail}</small>
                  </article>
                ))
              : transactions.length > 0
                ? [
                    {
                      label: '기간 수입',
                      value: totalIncome,
                      detail: '입금 거래 합계',
                      tone: 'income',
                    },
                    {
                      label: '생활비 사용',
                      value: livingExpenseSummary.totalAmountMinor,
                      detail:
                        livingExpenseSummary.sharedPaymentCount > 0
                          ? `공동결제 순지출 ${livingExpenseSummary.sharedPaymentCount}건 반영`
                          : '정산 연결 없음',
                      tone: 'expense',
                    },
                    {
                      label: '기간 출금',
                      value: totalOutflow,
                      detail: '원장 출금 합계',
                      tone: 'saving',
                    },
                  ].map((item) => (
                    <article className={`summary-card summary-card--${item.tone}`} key={item.label}>
                      <span>{item.label}</span>
                      <strong>{formatWon(item.value)}</strong>
                      <small>{item.detail}</small>
                    </article>
                  ))
                : ['기간 수입', '생활비 사용', '기간 출금'].map((label) => (
                    <article className="summary-card is-empty" key={label}>
                      <span>{label}</span>
                      <strong aria-label={`${label} 데이터 없음`}>—</strong>
                      <small>확인한 거래 없음</small>
                    </article>
                  ))}
            {!isMock && preset === 'MONTH' && !isLoading && !loadError ? (
              monthlyGoalProgress === undefined ? (
                <article className="summary-card summary-card--goal is-empty">
                  <span>월 생활비 목표</span>
                  <strong>설정 필요</strong>
                  <small>설정 페이지에서 월 목표를 입력하세요</small>
                </article>
              ) : (
                <article
                  className={
                    monthlyGoalProgress.status === 'EXCEEDED'
                      ? 'summary-card summary-card--goal-exceeded'
                      : 'summary-card summary-card--goal'
                  }
                >
                  <span>
                    {monthlyGoalProgress.status === 'EXCEEDED'
                      ? '월 목표 초과'
                      : '월 목표 잔액'}
                  </span>
                  <strong>{formatWon(monthlyGoalProgress.differenceAmountMinor)}</strong>
                  <small>
                    목표 {formatWon(monthlyGoalProgress.goalAmountMinor)} · 순생활비{' '}
                    {formatWon(monthlyGoalProgress.usedAmountMinor)}
                  </small>
                </article>
              )
            ) : null}
          </div>

          {!isMock &&
          localUserSettings !== undefined &&
          preset !== 'MONTH' ? (
            <p className="monthly-goal-period-note" role="status">
              월 생활비 목표는 월간 보기에서만 계산합니다. 현재 선택 기간에는 실제 사용액만 표시합니다.
            </p>
          ) : null}

          <article className="transactions-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">
                  {isMock ? '예시 내역' : '저장한 거래'}
                </p>
                <h3>{isMock ? '최근 거래' : '선택 기간 거래'}</h3>
              </div>
              <span>
                {isMock
                  ? '3건 · 예시'
                  : isLoading
                    ? '불러오는 중'
                    : `${filteredTransactions.length}건 · 로컬`}
              </span>
            </div>

            {!isMock && page === 'TRANSACTIONS' ? (
              <div className="transaction-review-tools">
                <div
                  className="transaction-filter-buttons"
                  role="group"
                  aria-label="거래 필터"
                >
                  {TRANSACTION_FILTERS.map((filter) => (
                    <button
                      type="button"
                      className={
                        transactionFilter === filter.id ? 'is-active' : undefined
                      }
                      aria-pressed={transactionFilter === filter.id}
                      key={filter.id}
                      onClick={() => {
                        setTransactionFilter(filter.id);
                        setTransactionEditDraft(null);
                        setTransactionEditError(null);
                      }}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                {transactionFilter === 'REVIEW' && reviewNeededCount > 0 ? (
                  <a className="transaction-review-queue-link" href="/review">
                    한 건씩 분류하기
                  </a>
                ) : null}
              </div>
            ) : null}

            {isMock ? (
              <ul className="transaction-list">
                {dashboardMockTransactions.map((transaction) => (
                  <li key={transaction.id}>
                    <span className="transaction-mark" aria-hidden="true">
                      {transaction.direction === 'IN' ? '+' : '−'}
                    </span>
                    <span className="transaction-copy">
                      <strong>{transaction.description}</strong>
                      <small>{transaction.category.replace('Mock', '예시')}</small>
                    </span>
                    <strong
                      className={
                        transaction.direction === 'IN'
                          ? 'amount amount--income'
                          : 'amount'
                      }
                    >
                      {transaction.direction === 'IN' ? '+' : '−'}
                      {formatWon(transaction.amountWon)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : isLoading ? (
              <div className="empty-transactions" role="status" aria-live="polite">
                <span className="empty-icon" aria-hidden="true">
                  ···
                </span>
                <div>
                  <strong>저장한 거래를 불러오는 중이에요</strong>
                  <p>이 기기의 로컬 장부를 확인하고 있습니다.</p>
                </div>
              </div>
            ) : loadError ? (
              <div className="empty-transactions" role="alert">
                <span className="empty-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>저장한 거래를 불러오지 못했어요</strong>
                  <p className="ledger-load-error">
                    이 브라우저의 로컬 저장소를 열지 못했습니다. 개인정보는 전송되지 않았습니다.
                  </p>
                  <button type="button" onClick={requestReload}>
                    다시 시도
                  </button>
                </div>
              </div>
            ) : filteredTransactions.length > 0 ? (
              <ul className="transaction-list">
                {filteredTransactions.map((transaction) => {
                  const category = getCategoryPresentation(transaction.categoryId);
                  const isEditingTransaction =
                    transactionEditDraft?.transactionId === transaction.id;

                  return (
                  <li key={transaction.id}>
                    <span className="transaction-mark" aria-hidden="true">
                      {category.emoji}
                    </span>
                    <span className="transaction-copy">
                      <strong>{transaction.descriptionOriginal}</strong>
                      <small>
                        {transaction.occurredOn} · {getTransactionTypeLabel(transaction.type)} ·{' '}
                        {category.emoji} {category.label}
                      </small>
                      {transaction.memo === undefined ? null : (
                        <small className="transaction-memo">메모: {transaction.memo}</small>
                      )}
                      <button
                        type="button"
                        className="transaction-row-edit-action"
                        aria-expanded={isEditingTransaction}
                        aria-controls={`transaction-edit-${transaction.id}`}
                        aria-label={`${transaction.descriptionOriginal} 카테고리·메모 수정`}
                        onClick={(event) =>
                          isEditingTransaction
                            ? closeTransactionEdit()
                            : startTransactionEdit(
                                transaction,
                                event.currentTarget,
                              )
                        }
                      >
                        카테고리·메모 수정
                      </button>
                    </span>
                    <strong
                      className={
                        transaction.direction === 'INFLOW'
                          ? 'amount amount--income'
                          : 'amount'
                      }
                    >
                      {transaction.direction === 'INFLOW' ? '+' : '−'}
                      {formatWon(transaction.amountMinor)}
                    </strong>
                  </li>
                  );
                })}
              </ul>
            ) : transactions.length > 0 ? (
              <div className="empty-transactions">
                <span className="empty-icon" aria-hidden="true">
                  ···
                </span>
                <div>
                  <strong>이 조건에 맞는 거래가 없어요</strong>
                  <p>다른 필터를 선택하면 저장한 거래를 다시 확인할 수 있어요.</p>
                </div>
              </div>
            ) : (
              <div className="empty-transactions">
                <span className="empty-icon" aria-hidden="true">
                  ···
                </span>
                <div>
                  <strong>아직 연결된 거래가 없습니다</strong>
                  <p>
                    XLS를 Preview한 뒤 후보를 이 기기에 저장하면 선택한 기간에 거래가 표시됩니다.
                  </p>
                </div>
              </div>
            )}
          </article>

          {!isMock && page === 'TRANSACTIONS' ? (
            <article className="settlement-panel" aria-labelledby="settlement-title">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">생활비 정산</p>
                  <h3 id="settlement-title">공동결제 정산</h3>
                </div>
                <span>{settlements.length}건 연결</span>
              </div>
              <p>
                내가 먼저 낸 출금과 받은 정산 입금을 연결하면 생활비에는 실제 순지출만 반영됩니다. 원장과 잔액은 바뀌지 않습니다.
              </p>

              <div className="settlement-form">
                <label>
                  원결제 출금
                  <select
                    aria-label="공동결제 원결제 출금"
                    value={payerTransactionId}
                    onChange={(event) => setPayerTransactionId(event.target.value)}
                  >
                    <option value="">출금 거래 선택</option>
                    {outflowCandidates.map((transaction) => (
                      <option value={transaction.id} key={transaction.id}>
                        {transaction.occurredOn} · {transaction.descriptionOriginal} · {formatWon(transaction.amountMinor)}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset>
                  <legend>정산 입금 (1건 이상)</legend>
                  {inflowCandidates.length > 0 ? (
                    <div className="settlement-reimbursement-list">
                      {inflowCandidates.map((transaction) => (
                        <label key={transaction.id}>
                          <input
                            type="checkbox"
                            checked={reimbursementTransactionIds.includes(transaction.id)}
                            onChange={(event) =>
                              handleReimbursementChange(transaction.id, event.target.checked)
                            }
                          />
                          <span>
                            {transaction.occurredOn} · {transaction.descriptionOriginal} · +
                            {formatWon(transaction.amountMinor)}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="settlement-empty">저장된 입금 거래가 없습니다.</p>
                  )}
                </fieldset>

                <button
                  type="button"
                  className="settlement-save-action"
                  disabled={
                    payerTransactionId === '' ||
                    reimbursementTransactionIds.length === 0
                  }
                  onClick={handleSaveSettlement}
                >
                  생활비 순지출로 연결
                </button>
              </div>

              {settlementNotice !== null ? (
                <p
                  className={`settlement-notice settlement-notice--${settlementNotice.tone}`}
                  role={settlementNotice.tone === 'error' ? 'alert' : 'status'}
                >
                  {settlementNotice.message}
                </p>
              ) : null}

              {settlements.length > 0 ? (
                <ul className="settlement-list" aria-label="연결한 공동결제 정산">
                  {settlements.map((settlement) => (
                    <li key={settlement.id}>
                      <span>{getSettlementSummary(settlement, allTransactions)}</span>
                      <button
                        type="button"
                        onClick={() => void handleRemoveSettlement(settlement.id)}
                      >
                        연결 해제
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ) : null}
          </>
        )}
      </div>

      {transactionEditDraft !== null && editingTransaction !== undefined ? (
        <div
          className="transaction-edit-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isSavingTransactionEdit
            ) {
              closeTransactionEdit();
            }
          }}
        >
          <div
            className="transaction-edit-sheet"
            ref={transactionEditDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`transaction-edit-title-${editingTransaction.id}`}
            aria-describedby={`transaction-edit-description-${editingTransaction.id}`}
          >
            <span className="transaction-edit-handle" aria-hidden="true" />
            <header className="transaction-edit-sheet-heading">
              <div>
                <p>거래 내용 수정</p>
                <h3 id={`transaction-edit-title-${editingTransaction.id}`}>
                  {editingTransaction.descriptionOriginal}
                </h3>
              </div>
              <button
                type="button"
                className="transaction-edit-close"
                aria-label={`${editingTransaction.descriptionOriginal} 수정 닫기`}
                disabled={isSavingTransactionEdit}
                onClick={closeTransactionEdit}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>
            <p
              className="transaction-edit-sheet-summary"
              id={`transaction-edit-description-${editingTransaction.id}`}
            >
              {editingTransaction.occurredOn} ·{' '}
              {getTransactionTypeLabel(editingTransaction.type)} ·{' '}
              {editingTransaction.direction === 'INFLOW' ? '+' : '−'}
              {formatWon(editingTransaction.amountMinor)}
            </p>

            <form
              className="transaction-edit-sheet-form"
              id={`transaction-edit-${editingTransaction.id}`}
              onSubmit={(event) => {
                event.preventDefault();
                void handleTransactionEditSave();
              }}
            >
              <label>
                카테고리
                <select
                  ref={transactionEditCategoryRef}
                  aria-label={`${editingTransaction.descriptionOriginal} 카테고리`}
                  value={transactionEditDraft.categoryId ?? ''}
                  disabled={isSavingTransactionEdit}
                  onChange={(event) =>
                    setTransactionEditDraft((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            categoryId:
                              event.target.value === ''
                                ? undefined
                                : (event.target.value as CategoryId),
                          },
                    )
                  }
                >
                  <option value="">🏷️ 미분류</option>
                  {CATEGORY_IDS.map((categoryId) => {
                    const presentation = getCategoryPresentation(categoryId);

                    return (
                      <option key={categoryId} value={categoryId}>
                        {presentation.emoji} {presentation.label}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                메모
                <textarea
                  aria-label={`${editingTransaction.descriptionOriginal} 메모`}
                  value={transactionEditDraft.memo}
                  placeholder="예: 공동 결제 후 정산 예정"
                  maxLength={280}
                  disabled={isSavingTransactionEdit}
                  onChange={(event) =>
                    setTransactionEditDraft((current) =>
                      current === null
                        ? current
                        : { ...current, memo: event.target.value },
                    )
                  }
                />
              </label>
              {transactionEditError === null ? null : (
                <p role="alert">{transactionEditError}</p>
              )}
              <span className="transaction-edit-sheet-actions">
                <button
                  type="button"
                  disabled={isSavingTransactionEdit}
                  onClick={closeTransactionEdit}
                >
                  취소
                </button>
                <button type="submit" disabled={isSavingTransactionEdit}>
                  {isSavingTransactionEdit ? '저장 중' : '저장'}
                </button>
              </span>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
