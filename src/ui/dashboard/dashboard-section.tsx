import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import {
  CATEGORY_IDS,
  type CategoryId,
} from '../../domain/categories/category';
import { createCustomCategory } from '../../domain/categories/custom-category';
import type { CustomCategory } from '../../domain/categories/custom-category';
import type {
  BudgetBucket,
  BudgetBucketId,
} from '../../domain/budget-buckets/budget-bucket';
import { getCategoryPresentation } from '../../domain/categories/category-presentation';
import { calculateMonthlyLivingExpenseGoalProgress } from '../../domain/settings/monthly-living-expense-goal-progress';
import type { LocalUserSettings } from '../../domain/settings/local-user-settings';
import { saveManualBudgetSettlement } from '../../application/ledger/save-manual-budget-settlement';
import { updateTransactionDetails } from '../../application/ledger/update-transaction-details';
import type { BudgetSettlement } from '../../domain/transactions/budget-settlement';
import {
  calculateBudgetBucketExpenseSummary,
  calculateLivingExpenseSummary,
} from '../../domain/transactions/living-expense';
import { isReviewNeededTransaction } from '../../domain/transactions/review-needed';
import {
  calculateSpendingInsights,
  type SpendingInsight,
} from '../../domain/transactions/spending-insights';
import {
  getTransactionDateRange,
  type TransactionPeriodPreset,
} from '../../domain/transactions/transaction-period';
import type { CalendarDate } from '../../domain/transactions/calendar-date';
import type { Transaction } from '../../domain/transactions/transaction';
import {
  createTransactionAttachment,
  MAX_TRANSACTION_ATTACHMENT_BYTES,
  type TransactionAttachment,
} from '../../domain/transactions/transaction-attachment';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';
import { BrowserLedgerRepository } from '../../infrastructure/storage/browser-ledger-repository';
import { formatWon } from '../../shared/format/currency';
import { AppIcon } from '../shell/app-icon';
import { CategoryCreateForm } from '../shared/category-create-form';
import {
  dashboardMockSummary,
  dashboardMockTransactions,
} from './dashboard-fixtures';
import './dashboard-refresh.css';

type DashboardMode = 'LOCAL' | 'MOCK';
type DashboardPage = 'HOME' | 'TRANSACTIONS';
type LedgerWorkspace = 'TRANSACTIONS' | 'SETTLEMENTS';
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
  | 'listBudgetBuckets'
> &
  Partial<
    Pick<
      BrowserLedgerRepository,
  | 'listCustomCategories'
  | 'saveCustomCategory'
  | 'getTransactionAttachment'
  | 'saveTransactionAttachment'
  | 'removeTransactionAttachment'
    >
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
  budgetBucketId: BudgetBucketId;
  memo: string;
}>;

type WeeklySpendingDay = Readonly<{
  date: CalendarDate;
  weekdayLabel: string;
  amountMinor: number;
}>;

type BudgetBucketSpendingItem = Readonly<{
  bucket: BudgetBucket;
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
const HOME_SPENDING_INSIGHT_LIMIT = 3;

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

function readTransactionImage(
  file: File,
  transactionId: string,
): Promise<TransactionAttachment | undefined> {
  if (
    !file.type.startsWith('image/') ||
    file.size <= 0 ||
    file.size > MAX_TRANSACTION_ATTACHMENT_BYTES
  ) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        resolve(undefined);
        return;
      }

      resolve(
        createTransactionAttachment({
          transactionId,
          dataUrl: reader.result,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          updatedAt: currentUtcIsoInstant(),
        }),
      );
    });
    reader.addEventListener('error', () => resolve(undefined));
    reader.readAsDataURL(file);
  });
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

function getCategoryPresentationFor(
  categoryId: CategoryId | undefined,
  customCategories: readonly CustomCategory[],
) {
  if (categoryId === undefined) {
    return getCategoryPresentation(categoryId);
  }

  const customCategory = customCategories.find(
    (category) => category.id === categoryId,
  );
  return customCategory === undefined
    ? getCategoryPresentation(categoryId)
    : { label: customCategory.name, emoji: customCategory.emoji };
}

function getSettlementErrorMessage(code: Exclude<
  Awaited<ReturnType<typeof saveManualBudgetSettlement>>,
  { isSaved: true }
>['code']): string {
  const messages = {
    invalid_settlement: '공동결제 지출 1건 이상과 정산 입금 1건 이상을 다시 선택해 주세요.',
    missing_transaction: '선택한 거래를 찾을 수 없습니다. 목록을 새로 확인해 주세요.',
    outflows_must_be_outflow: '공동결제 지출은 출금 거래만 선택할 수 있습니다.',
    inflows_must_be_inflow: '정산금은 입금 거래만 선택할 수 있습니다.',
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
  const outflows = settlement.outflowTransactionIds
    .map((transactionId) => transactionById.get(transactionId))
    .filter((transaction): transaction is Transaction => transaction !== undefined);
  const inflows = settlement.inflowTransactionIds
    .map((transactionId) => transactionById.get(transactionId))
    .filter((transaction): transaction is Transaction => transaction !== undefined);
  const firstOutflow = outflows[0];
  if (firstOutflow === undefined) {
    return '연결한 공동결제';
  }

  const outflowTotal = outflows.reduce((total, transaction) => total + transaction.amountMinor, 0);
  const inflowTotal = inflows.reduce((total, transaction) => total + transaction.amountMinor, 0);
  const extraOutflowLabel = outflows.length > 1 ? ` 외 ${outflows.length - 1}건` : '';
  const extraInflowLabel = inflows.length > 1 ? ` 외 ${inflows.length - 1}건` : '';

  return `${firstOutflow.occurredOn} · ${firstOutflow.descriptionOriginal}${extraOutflowLabel} · 지출 ${formatWon(outflowTotal)} · 수입 ${formatWon(inflowTotal)}${extraInflowLabel}`;
}

type HomeDashboardProps = Readonly<{
  livingExpenseAmountMinor: number;
  totalExpenseAmountMinor: number;
  budgetBucketSpending: readonly BudgetBucketSpendingItem[];
  spendingInsights: readonly SpendingInsight[];
  monthlyGoalProgress: ReturnType<
    typeof calculateMonthlyLivingExpenseGoalProgress
  >;
  reviewNeededCount: number;
  weeklySpending: readonly WeeklySpendingDay[];
  recentTransactions: readonly Transaction[];
  customCategories: readonly CustomCategory[];
  isLoading: boolean;
  loadError: boolean;
  onRetry: () => void;
}>;

function HomeDashboard({
  livingExpenseAmountMinor,
  totalExpenseAmountMinor,
  budgetBucketSpending,
  spendingInsights,
  monthlyGoalProgress,
  reviewNeededCount,
  weeklySpending,
  recentTransactions,
  customCategories,
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

      <section className="home-budget-bucket-card" aria-labelledby="home-budget-bucket-title">
        <div className="home-card-heading">
          <div>
            <p className="panel-kicker">이번 달 전체 소비</p>
            <h3 id="home-budget-bucket-title">돈의 목적별 소비</h3>
          </div>
          <strong>{formatWon(totalExpenseAmountMinor)}</strong>
        </div>
        <ul aria-label="돈의 목적별 소비">
          {budgetBucketSpending.map(({ bucket, amountMinor }) => (
            <li key={bucket.id}>
              <span aria-hidden="true">{bucket.icon}</span>
              <strong>{bucket.name}</strong>
              <small>{formatWon(amountMinor)}</small>
            </li>
          ))}
        </ul>
      </section>

      {spendingInsights.length > 0 ? (
        <section className="home-insight-card" aria-labelledby="home-insight-title">
          <div className="home-card-heading">
            <div>
              <p className="panel-kicker">이번 달 소비 패턴</p>
              <h3 id="home-insight-title">반복해서 쓴 곳</h3>
            </div>
            <span>2번 이상</span>
          </div>
          <p className="home-insight-description">
            같은 카테고리에서 같은 기록이 반복됐어요.
          </p>
          <ul className="home-insight-list" aria-label="반복 지출 요약">
            {spendingInsights
              .slice(0, HOME_SPENDING_INSIGHT_LIMIT)
              .map((insight) => {
                const category = getCategoryPresentationFor(
                  insight.categoryId,
                  customCategories,
                );
                const insightLabel = `${category.label}에서 ${insight.label} ${insight.count}번, ${formatWon(insight.totalAmountMinor)} 썼어요`;

                return (
                  <li
                    key={`${insight.categoryId}-${insight.label}`}
                    aria-label={insightLabel}
                  >
                    <span className="home-insight-mark" aria-hidden="true">
                      {category.emoji}
                    </span>
                    <span className="home-insight-copy">
                      <strong>
                        {category.label} · {insight.label}
                      </strong>
                      <small>{insight.count}번 반복</small>
                    </span>
                    <strong className="home-insight-amount">
                      {formatWon(insight.totalAmountMinor)}
                    </strong>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

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
              const category = getCategoryPresentationFor(
                transaction.categoryId,
                customCategories,
              );

              return (
                <li
                  className={
                    transaction.direction === 'INFLOW'
                      ? 'transaction-row transaction-row--income'
                      : 'transaction-row transaction-row--expense'
                  }
                  key={transaction.id}
                >
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
                        : 'amount amount--expense'
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
  const [ledgerWorkspace, setLedgerWorkspace] =
    useState<LedgerWorkspace>('TRANSACTIONS');
  const [preset, setPreset] = useState<TransactionPeriodPreset>('MONTH');
  const [anchorOn, setAnchorOn] = useState(getTodayInSeoul);
  const [customStartOn, setCustomStartOn] = useState(getTodayInSeoul);
  const [customEndOn, setCustomEndOn] = useState(getTodayInSeoul);
  const [transactions, setTransactions] = useState<readonly Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<readonly Transaction[]>(
    [],
  );
  const [settlements, setSettlements] = useState<readonly BudgetSettlement[]>([]);
  const [budgetBuckets, setBudgetBuckets] = useState<readonly BudgetBucket[]>([]);
  const [customCategories, setCustomCategories] = useState<
    readonly CustomCategory[]
  >([]);
  const [localUserSettings, setLocalUserSettings] = useState<
    LocalUserSettings | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [outflowTransactionIds, setOutflowTransactionIds] = useState<
    readonly string[]
  >([]);
  const [inflowTransactionIds, setInflowTransactionIds] = useState<
    readonly string[]
  >([]);
  const [settlementBudgetBucketId, setSettlementBudgetBucketId] = useState<
    BudgetBucketId
  >('LIVING');
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
  const [transactionAttachment, setTransactionAttachment] = useState<
    TransactionAttachment | undefined
  >(undefined);
  const [pendingTransactionAttachment, setPendingTransactionAttachment] =
    useState<TransactionAttachment | null | undefined>(undefined);
  const [isLoadingTransactionAttachment, setIsLoadingTransactionAttachment] =
    useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [transactionFilter, setTransactionFilter] =
    useState<TransactionFilter>('ALL');
  const [budgetBucketFilter, setBudgetBucketFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<
    CategoryId | 'ALL' | 'UNCLASSIFIED'
  >('ALL');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<
    ReadonlySet<string>
  >(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<
    CategoryId | 'UNCHANGED' | ''
  >('UNCHANGED');
  const [bulkBudgetBucketId, setBulkBudgetBucketId] = useState<
    BudgetBucketId | 'UNCHANGED'
  >('UNCHANGED');
  const [isSavingBulkEdit, setIsSavingBulkEdit] = useState(false);
  const [bulkEditMessage, setBulkEditMessage] = useState<string | null>(null);
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
    setTransactionAttachment(undefined);
    setPendingTransactionAttachment(undefined);
    setIsLoadingTransactionAttachment(false);
    setIsCreatingCategory(false);
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
    if (activeTransactionEditId === undefined) {
      return undefined;
    }

    const getAttachment = ledgerRepository.getTransactionAttachment;
    if (getAttachment === undefined) {
      setTransactionAttachment(undefined);
      setIsLoadingTransactionAttachment(false);
      return undefined;
    }

    let isCurrent = true;
    setIsLoadingTransactionAttachment(true);
    void getAttachment(activeTransactionEditId)
      .then((nextAttachment) => {
        if (!isCurrent) {
          return;
        }
        setTransactionAttachment(nextAttachment);
        setIsLoadingTransactionAttachment(false);
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }
        setTransactionAttachment(undefined);
        setIsLoadingTransactionAttachment(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [activeTransactionEditId, ledgerRepository]);

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
      ledgerRepository.listBudgetBuckets(),
      ledgerRepository.listCustomCategories?.() ?? Promise.resolve([]),
    ])
      .then(
        ([
          rangeTransactions,
          nextAllTransactions,
          nextSettlements,
          nextLocalUserSettings,
          nextBudgetBuckets,
          nextCustomCategories,
        ]) => {
          if (!isCurrent) {
            return;
          }
          setTransactions(rangeTransactions);
          setAllTransactions(nextAllTransactions);
          setSettlements(nextSettlements);
          setLocalUserSettings(nextLocalUserSettings);
          setBudgetBuckets(nextBudgetBuckets);
          setCustomCategories(nextCustomCategories);
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
        setBudgetBuckets([]);
        setCustomCategories([]);
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
  const budgetBucketSpending =
    rangeResult.isValid
      ? budgetBuckets
          .filter((bucket) => !bucket.isArchived)
          .map((bucket) => ({
            bucket,
            amountMinor: calculateBudgetBucketExpenseSummary(
              allTransactions,
              settlements,
              rangeResult.value,
              bucket.id,
            ).totalAmountMinor,
          }))
      : [];
  const totalBudgetBucketExpenseAmountMinor = budgetBucketSpending.reduce(
    (total, item) => total + item.amountMinor,
    0,
  );
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
  const transactionFilterResult = useMemo(
    () => filterTransactions(transactions, transactionFilter),
    [transactionFilter, transactions],
  );
  const purposeFilteredTransactions = useMemo(
    () =>
      budgetBucketFilter === 'ALL'
        ? transactionFilterResult
        : transactionFilterResult.filter(
            (transaction) => transaction.budgetBucketId === budgetBucketFilter,
          ),
    [budgetBucketFilter, transactionFilterResult],
  );
  const categoryFilterOptions = useMemo(
    () => [
      ...CATEGORY_IDS.filter((categoryId) =>
        purposeFilteredTransactions.some(
          (transaction) => transaction.categoryId === categoryId,
        ),
      ),
      ...customCategories
        .filter((category) =>
          purposeFilteredTransactions.some(
            (transaction) => transaction.categoryId === category.id,
          ),
        )
        .map((category) => category.id),
    ],
    [customCategories, purposeFilteredTransactions],
  );
  const filteredTransactions = useMemo(
    () =>
      purposeFilteredTransactions.filter((transaction) =>
        categoryFilter === 'ALL'
          ? true
          : categoryFilter === 'UNCLASSIFIED'
            ? transaction.categoryId === undefined
            : transaction.categoryId === categoryFilter,
      ),
    [categoryFilter, purposeFilteredTransactions],
  );
  const areAllVisibleTransactionsSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((transaction) =>
      selectedTransactionIds.has(transaction.id),
    );
  const editingTransaction =
    transactionEditDraft === null
      ? undefined
      : transactions.find(
          (transaction) => transaction.id === transactionEditDraft.transactionId,
        );
  const visibleTransactionAttachment =
    pendingTransactionAttachment === undefined
      ? transactionAttachment
      : pendingTransactionAttachment ?? undefined;
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
  const linkedOutflowTransactionIds = new Set(
    settlements.flatMap((settlement) => settlement.outflowTransactionIds),
  );
  const spendingInsights =
    page === 'HOME' && !isMock
      ? calculateSpendingInsights(
          transactions,
          linkedOutflowTransactionIds,
        )
      : [];
  const linkedTransactionIds = new Set(
    settlements.flatMap((settlement) => [
      ...settlement.outflowTransactionIds,
      ...settlement.inflowTransactionIds,
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
  const selectedOutflowTotal = outflowCandidates
    .filter((transaction) => outflowTransactionIds.includes(transaction.id))
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
  const selectedInflowTotal = inflowCandidates
    .filter((transaction) => inflowTransactionIds.includes(transaction.id))
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
  const selectedSettlementNet = Math.max(
    selectedOutflowTotal - selectedInflowTotal,
    0,
  );

  const resetTransactionSelection = () => {
    setSelectedTransactionIds(new Set());
    setBulkEditMessage(null);
  };

  const handleTransactionFilterChange = (nextFilter: TransactionFilter) => {
    setTransactionFilter(nextFilter);
    setCategoryFilter('ALL');
    resetTransactionSelection();
    setTransactionEditDraft(null);
    setTransactionEditError(null);
  };

  const handleBudgetBucketFilterChange = (nextFilter: string) => {
    setBudgetBucketFilter(nextFilter);
    setCategoryFilter('ALL');
    resetTransactionSelection();
  };

  const handleCategoryFilterChange = (
    nextFilter: CategoryId | 'ALL' | 'UNCLASSIFIED',
  ) => {
    setCategoryFilter(nextFilter);
    resetTransactionSelection();
  };

  const toggleTransactionSelection = (
    transactionId: string,
    checked: boolean,
  ) => {
    setSelectedTransactionIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (checked) {
        nextIds.add(transactionId);
      } else {
        nextIds.delete(transactionId);
      }
      return nextIds;
    });
    setBulkEditMessage(null);
  };

  const toggleAllVisibleTransactions = (checked: boolean) => {
    setSelectedTransactionIds((currentIds) => {
      const nextIds = new Set(currentIds);
      filteredTransactions.forEach((transaction) => {
        if (checked) {
          nextIds.add(transaction.id);
        } else {
          nextIds.delete(transaction.id);
        }
      });
      return nextIds;
    });
    setBulkEditMessage(null);
  };

  const handleBulkEditSave = async () => {
    const selectedTransactions = transactions.filter((transaction) =>
      selectedTransactionIds.has(transaction.id),
    );
    if (
      selectedTransactions.length === 0 ||
      (bulkCategoryId === 'UNCHANGED' && bulkBudgetBucketId === 'UNCHANGED')
    ) {
      setBulkEditMessage('바꿀 카테고리나 돈의 목적을 하나 이상 선택해 주세요.');
      return;
    }

    setIsSavingBulkEdit(true);
    setBulkEditMessage(null);
    const results = await Promise.all(
      selectedTransactions.map((transaction) =>
        updateTransactionDetails(
          {
            transactionId: transaction.id,
            categoryId:
              bulkCategoryId === 'UNCHANGED'
                ? transaction.categoryId
                : bulkCategoryId === ''
                  ? undefined
                  : bulkCategoryId,
            budgetBucketId:
              bulkBudgetBucketId === 'UNCHANGED'
                ? transaction.budgetBucketId
                : bulkBudgetBucketId,
            memo: transaction.memo,
            updatedAt: currentUtcIsoInstant(),
          },
          ledgerRepository,
        ),
      ),
    );
    setIsSavingBulkEdit(false);

    const updatedTransactions = results.flatMap((result) =>
      result.isUpdated ? [result.transaction] : [],
    );
    if (updatedTransactions.length !== selectedTransactions.length) {
      setBulkEditMessage(
        '일부 거래를 저장하지 못했습니다. 변경하지 못한 거래를 다시 확인해 주세요.',
      );
      return;
    }

    const updatedById = new Map(
      updatedTransactions.map((transaction) => [transaction.id, transaction]),
    );
    setTransactions((currentTransactions) =>
      currentTransactions.map(
        (transaction) => updatedById.get(transaction.id) ?? transaction,
      ),
    );
    setAllTransactions((currentTransactions) =>
      currentTransactions.map(
        (transaction) => updatedById.get(transaction.id) ?? transaction,
      ),
    );
    setSelectedTransactionIds(new Set());
    setBulkCategoryId('UNCHANGED');
    setBulkBudgetBucketId('UNCHANGED');
    setBulkEditMessage(`${updatedTransactions.length}건의 분류를 바꿨어요.`);
  };

  const handleSettlementTransactionChange = (
    transactionId: string,
    checked: boolean,
    setSelectedIds: Dispatch<SetStateAction<readonly string[]>>,
  ) => {
    setSelectedIds((current) =>
      checked
        ? current.includes(transactionId)
          ? current
          : [...current, transactionId]
        : current.filter((item) => item !== transactionId),
    );
  };

  const handleSaveSettlement = async () => {
    const now = currentUtcIsoInstant();
    const result = await saveManualBudgetSettlement(
      {
        id: createLocalId(),
        outflowTransactionIds,
        inflowTransactionIds,
        budgetBucketId: settlementBudgetBucketId,
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

    setOutflowTransactionIds([]);
    setInflowTransactionIds([]);
    setSettlementBudgetBucketId('LIVING');
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

  const handleTransactionImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    const transactionId = transactionEditDraft?.transactionId;

    if (file === undefined || transactionId === undefined) {
      return;
    }

    setTransactionEditError(null);
    const attachment = await readTransactionImage(file, transactionId);

    if (attachment === undefined) {
      setTransactionEditError(
        '이미지는 3MB 이하의 이미지 파일만 추가할 수 있습니다.',
      );
      return;
    }

    setPendingTransactionAttachment(attachment);
  };

  const removeTransactionImage = () => {
    setPendingTransactionAttachment(null);
    setTransactionEditError(null);
  };

  const handleCreateCustomCategory = async (
    name: string,
    emoji: string,
  ): Promise<CustomCategory | undefined> => {
    if (ledgerRepository.saveCustomCategory === undefined) {
      return undefined;
    }

    const category = createCustomCategory(
      {
        id: `CUSTOM_${createLocalId()}` as CustomCategory['id'],
        name,
        emoji,
      },
      currentUtcIsoInstant(),
    );
    if (category === undefined) {
      return undefined;
    }

    try {
      await ledgerRepository.saveCustomCategory(category);
    } catch {
      return undefined;
    }
    setCustomCategories((currentCategories) => [
      ...currentCategories,
      category,
    ]);
    return category;
  };

  const startTransactionEdit = (
    transaction: Transaction,
    trigger: HTMLButtonElement,
  ) => {
    transactionEditTriggerRef.current = trigger;
    setTransactionEditDraft({
      transactionId: transaction.id,
      categoryId: transaction.categoryId,
      budgetBucketId: transaction.budgetBucketId,
      memo: transaction.memo ?? '',
    });
    setTransactionAttachment(undefined);
    setPendingTransactionAttachment(undefined);
    setIsLoadingTransactionAttachment(false);
    setIsCreatingCategory(false);
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
        budgetBucketId: transactionEditDraft.budgetBucketId,
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

    if (pendingTransactionAttachment !== undefined) {
      try {
        if (pendingTransactionAttachment === null) {
          if (ledgerRepository.removeTransactionAttachment === undefined) {
            throw new Error('Transaction attachment storage is unavailable.');
          }
          await ledgerRepository.removeTransactionAttachment(
            transactionEditDraft.transactionId,
          );
        } else {
          if (ledgerRepository.saveTransactionAttachment === undefined) {
            throw new Error('Transaction attachment storage is unavailable.');
          }
          await ledgerRepository.saveTransactionAttachment(
            pendingTransactionAttachment,
          );
        }
      } catch {
        setTransactionEditError(
          '거래는 저장했지만 이미지를 저장하지 못했습니다. 다시 시도해 주세요.',
        );
        return;
      }
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
    setTransactionAttachment(
      pendingTransactionAttachment === null
        ? undefined
        : pendingTransactionAttachment ?? transactionAttachment,
    );
    setPendingTransactionAttachment(undefined);
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
            {page === 'HOME' ? 'ALL D·DEAL · 알뜰' : '저장한 기록'}
          </p>
          <h2 id="ledger-title">
            {page === 'HOME'
              ? '흩어진 금융 기록을 알뜰하게.'
              : '모든 거래를 한곳에서 확인하세요'}
          </h2>
          <p>
            {page === 'HOME'
              ? '카드·계좌 파일을 이 기기에만 정리하고, 중요한 거래를 한눈에 확인합니다.'
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
        {page === 'TRANSACTIONS' && !isMock ? (
          <div
            className="ledger-workspace-tabs"
            role="group"
            aria-label="거래 작업 공간"
          >
            <button
              type="button"
              aria-pressed={ledgerWorkspace === 'TRANSACTIONS'}
              className={
                ledgerWorkspace === 'TRANSACTIONS' ? 'is-active' : undefined
              }
              onClick={() => setLedgerWorkspace('TRANSACTIONS')}
            >
              거래 목록
            </button>
            <button
              type="button"
              aria-pressed={ledgerWorkspace === 'SETTLEMENTS'}
              className={
                ledgerWorkspace === 'SETTLEMENTS' ? 'is-active' : undefined
              }
              onClick={() => setLedgerWorkspace('SETTLEMENTS')}
            >
              공동결제 정산
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

      {!isMock &&
      page === 'TRANSACTIONS' &&
      ledgerWorkspace === 'TRANSACTIONS' ? (
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

      <div className={`ledger-main ledger-main--${ledgerWorkspace.toLowerCase()}`}>
        {page === 'HOME' && !isMock ? (
          <HomeDashboard
            livingExpenseAmountMinor={livingExpenseSummary.totalAmountMinor}
            totalExpenseAmountMinor={totalBudgetBucketExpenseAmountMinor}
            budgetBucketSpending={budgetBucketSpending}
            spendingInsights={spendingInsights}
            monthlyGoalProgress={monthlyGoalProgress}
            reviewNeededCount={reviewNeededCount}
            weeklySpending={weeklySpending}
            recentTransactions={recentTransactions}
            customCategories={customCategories}
            isLoading={isLoading}
            loadError={loadError}
            onRetry={requestReload}
          />
        ) : (
          <>
          {ledgerWorkspace === 'TRANSACTIONS' ? (
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
              <>
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
                      onClick={() => handleTransactionFilterChange(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <label className="transaction-select-all">
                  <input
                    type="checkbox"
                    aria-label="표시된 거래 모두 선택"
                    checked={areAllVisibleTransactionsSelected}
                    onChange={(event) =>
                      toggleAllVisibleTransactions(event.target.checked)
                    }
                  />
                  <span>표시된 거래 모두 선택</span>
                </label>
                {transactionFilter === 'REVIEW' && reviewNeededCount > 0 ? (
                  <a className="transaction-review-queue-link" href="/review">
                    한 건씩 분류하기
                  </a>
                ) : null}
              </div>
              <div className="transaction-filter-groups">
                <div
                  className="transaction-purpose-tabs"
                  role="group"
                  aria-label="돈의 목적별 보기"
                >
                  <button
                    type="button"
                    className={
                      budgetBucketFilter === 'ALL' ? 'is-active' : undefined
                    }
                    aria-pressed={budgetBucketFilter === 'ALL'}
                    onClick={() => handleBudgetBucketFilterChange('ALL')}
                  >
                    전체
                  </button>
                  {budgetBuckets.map((bucket) => (
                    <button
                      type="button"
                      className={
                        budgetBucketFilter === bucket.id ? 'is-active' : undefined
                      }
                      aria-label={bucket.name}
                      aria-pressed={budgetBucketFilter === bucket.id}
                      key={bucket.id}
                      onClick={() => handleBudgetBucketFilterChange(bucket.id)}
                    >
                      {bucket.icon} {bucket.name}
                    </button>
                  ))}
                </div>
                <div
                  className="transaction-category-tabs"
                  role="group"
                  aria-label="카테고리별 보기"
                >
                  <button
                    type="button"
                    className={categoryFilter === 'ALL' ? 'is-active' : undefined}
                    aria-pressed={categoryFilter === 'ALL'}
                    onClick={() => handleCategoryFilterChange('ALL')}
                  >
                    전체 카테고리
                  </button>
                  {purposeFilteredTransactions.some(
                    (transaction) => transaction.categoryId === undefined,
                  ) ? (
                    <button
                      type="button"
                      className={
                        categoryFilter === 'UNCLASSIFIED' ? 'is-active' : undefined
                      }
                      aria-pressed={categoryFilter === 'UNCLASSIFIED'}
                      onClick={() => handleCategoryFilterChange('UNCLASSIFIED')}
                    >
                      미분류
                    </button>
                  ) : null}
                  {categoryFilterOptions.map((categoryId) => {
                    const category = getCategoryPresentationFor(
                      categoryId,
                      customCategories,
                    );
                    return (
                      <button
                        type="button"
                        className={
                          categoryFilter === categoryId ? 'is-active' : undefined
                        }
                        aria-label={category.label}
                        aria-pressed={categoryFilter === categoryId}
                        key={categoryId}
                        onClick={() => handleCategoryFilterChange(categoryId)}
                      >
                        {category.emoji} {category.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedTransactionIds.size > 0 ? (
                <div className="bulk-edit-toolbar">
                  <strong>{selectedTransactionIds.size}건 선택됨</strong>
                  <label>
                    일괄 카테고리
                    <span className="dashboard-select-control">
                      <select
                        aria-label="일괄 카테고리"
                        value={bulkCategoryId}
                        disabled={isSavingBulkEdit}
                        onChange={(event) =>
                          setBulkCategoryId(
                            event.target.value as CategoryId | 'UNCHANGED' | '',
                          )
                        }
                      >
                        <option value="UNCHANGED">카테고리 유지</option>
                        <option value="">미분류</option>
                        {CATEGORY_IDS.map((categoryId) => {
                          const category = getCategoryPresentationFor(
                            categoryId,
                            customCategories,
                          );
                          return (
                            <option key={categoryId} value={categoryId}>
                              {category.emoji} {category.label}
                            </option>
                          );
                        })}
                        {customCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.emoji} {category.name}
                          </option>
                        ))}
                      </select>
                      <span className="dashboard-select-chevron" aria-hidden="true">
                        ⌄
                      </span>
                    </span>
                  </label>
                  <label>
                    일괄 돈의 목적
                    <span className="dashboard-select-control">
                      <select
                        aria-label="일괄 돈의 목적"
                        value={bulkBudgetBucketId}
                        disabled={isSavingBulkEdit}
                        onChange={(event) =>
                          setBulkBudgetBucketId(event.target.value)
                        }
                      >
                        <option value="UNCHANGED">돈의 목적 유지</option>
                        {budgetBuckets
                          .filter((bucket) => !bucket.isArchived)
                          .map((bucket) => (
                            <option key={bucket.id} value={bucket.id}>
                              {bucket.icon} {bucket.name}
                            </option>
                          ))}
                      </select>
                      <span className="dashboard-select-chevron" aria-hidden="true">
                        ⌄
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleBulkEditSave()}
                    disabled={isSavingBulkEdit}
                  >
                    {isSavingBulkEdit ? '저장 중' : '선택한 거래 저장'}
                  </button>
                  <button
                    type="button"
                    className="bulk-edit-cancel"
                    onClick={resetTransactionSelection}
                    disabled={isSavingBulkEdit}
                  >
                    선택 해제
                  </button>
                </div>
              ) : null}
              {bulkEditMessage === null ? null : (
                <p className="bulk-edit-message" role="status">
                  {bulkEditMessage}
                </p>
              )}
              </>
            ) : null}

            {isMock ? (
              <ul className="transaction-list">
                {dashboardMockTransactions.map((transaction) => (
                  <li
                    className={
                      transaction.direction === 'IN'
                        ? 'transaction-row transaction-row--income'
                        : 'transaction-row transaction-row--expense'
                    }
                    key={transaction.id}
                  >
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
                          : 'amount amount--expense'
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
                  const category = getCategoryPresentationFor(
                    transaction.categoryId,
                    customCategories,
                  );
                  const isEditingTransaction =
                    transactionEditDraft?.transactionId === transaction.id;
                  const isSelected = selectedTransactionIds.has(transaction.id);

                  return (
                  <li
                    className={
                      transaction.direction === 'INFLOW'
                        ? 'transaction-row transaction-row--income'
                        : 'transaction-row transaction-row--expense'
                    }
                    key={transaction.id}
                  >
                    <input
                      type="checkbox"
                      className="transaction-row-selection"
                      aria-label={`거래 선택 ${transaction.descriptionOriginal}`}
                      checked={isSelected}
                      onChange={(event) =>
                        toggleTransactionSelection(
                          transaction.id,
                          event.target.checked,
                        )
                      }
                    />
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
                        : 'amount amount--expense'
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
            </>
          ) : (
            <section className="settlement-workspace-intro" aria-labelledby="settlement-workspace-title">
              <p className="panel-kicker">공동결제 정산</p>
              <h3 id="settlement-workspace-title">함께 쓴 결제를 깔끔하게 정리하세요</h3>
              <p>
                여러 지출과 정산 입금을 하나의 묶음으로 연결하면 생활비에는
                실제 부담한 순지출만 반영됩니다.
              </p>
            </section>
          )}

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
                공동결제에 포함된 지출과 여러 사람이 보낸 정산 입금을 함께 연결하면 생활비에는 실제 순지출만 반영됩니다. 원장과 잔액은 바뀌지 않습니다.
              </p>

              <div className="settlement-form">
                <label>
                  정산 순지출 목적
                  <span className="dashboard-select-control">
                    <select
                      aria-label="공동결제 정산 목적"
                      value={settlementBudgetBucketId}
                      onChange={(event) =>
                        setSettlementBudgetBucketId(event.target.value)
                      }
                    >
                      {budgetBuckets
                        .filter((bucket) => !bucket.isArchived)
                        .map((bucket) => (
                          <option key={bucket.id} value={bucket.id}>
                            {bucket.icon} {bucket.name}
                          </option>
                        ))}
                    </select>
                    <span className="dashboard-select-chevron" aria-hidden="true">
                      ⌄
                    </span>
                  </span>
                </label>
                <fieldset>
                  <legend>공동결제 지출 (1건 이상)</legend>
                  {outflowCandidates.length > 0 ? (
                    <div className="settlement-reimbursement-list">
                      {outflowCandidates.map((transaction) => (
                        <label key={transaction.id}>
                          <input
                            type="checkbox"
                            aria-label={`공동결제 지출 ${transaction.descriptionOriginal}`}
                            checked={outflowTransactionIds.includes(transaction.id)}
                            onChange={(event) =>
                              handleSettlementTransactionChange(
                                transaction.id,
                                event.target.checked,
                                setOutflowTransactionIds,
                              )
                            }
                          />
                          <span>
                            {transaction.occurredOn} · {transaction.descriptionOriginal} · −
                            {formatWon(transaction.amountMinor)}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="settlement-empty">연결할 출금 거래가 없습니다.</p>
                  )}
                </fieldset>

                <fieldset>
                  <legend>정산 입금 (1건 이상)</legend>
                  {inflowCandidates.length > 0 ? (
                    <div className="settlement-reimbursement-list">
                      {inflowCandidates.map((transaction) => (
                        <label key={transaction.id}>
                          <input
                            type="checkbox"
                            aria-label={`정산 입금 ${transaction.descriptionOriginal}`}
                            checked={inflowTransactionIds.includes(transaction.id)}
                            onChange={(event) =>
                              handleSettlementTransactionChange(
                                transaction.id,
                                event.target.checked,
                                setInflowTransactionIds,
                              )
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
                    <p className="settlement-empty">연결할 입금 거래가 없습니다.</p>
                  )}
                </fieldset>

                <p className="settlement-selection-summary" aria-live="polite">
                  선택 {outflowTransactionIds.length}건 지출 · {inflowTransactionIds.length}건 입금 · 순지출 {formatWon(selectedSettlementNet)}
                </p>

                <button
                  type="button"
                  className="settlement-save-action"
                  disabled={
                    outflowTransactionIds.length === 0 ||
                    inflowTransactionIds.length === 0
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
                <AppIcon name="close" size={20} />
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
              <div className="transaction-edit-category-field">
                <label>
                  카테고리
                  <span className="dashboard-select-control">
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
                      const presentation = getCategoryPresentationFor(
                        categoryId,
                        customCategories,
                      );

                      return (
                        <option key={categoryId} value={categoryId}>
                          {presentation.emoji} {presentation.label}
                        </option>
                      );
                    })}
                    {customCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.emoji} {category.name}
                      </option>
                    ))}
                  </select>
                  <span className="dashboard-select-chevron" aria-hidden="true">
                    ⌄
                  </span>
                  </span>
                </label>
                {ledgerRepository.saveCustomCategory === undefined ? null : (
                  <>
                    {isCreatingCategory ? (
                      <CategoryCreateForm
                        onCreateCategory={handleCreateCustomCategory}
                        onCreated={(category) => {
                          setIsCreatingCategory(false);
                          setTransactionEditDraft((current) =>
                            current === null
                              ? current
                              : { ...current, categoryId: category.id },
                          );
                        }}
                        onCancel={() => setIsCreatingCategory(false)}
                        disabled={isSavingTransactionEdit}
                      />
                    ) : (
                      <button
                        type="button"
                        className="category-create-trigger"
                        onClick={() => setIsCreatingCategory(true)}
                        disabled={isSavingTransactionEdit}
                      >
                        + 새 카테고리 추가
                      </button>
                    )}
                  </>
                )}
              </div>
              <label>
                돈의 목적
                <span className="dashboard-select-control">
                  <select
                    aria-label={`${editingTransaction.descriptionOriginal} 돈의 목적`}
                    value={transactionEditDraft.budgetBucketId}
                    disabled={isSavingTransactionEdit}
                    onChange={(event) =>
                      setTransactionEditDraft((current) =>
                        current === null
                          ? current
                          : {
                              ...current,
                              budgetBucketId: event.target.value,
                            },
                      )
                    }
                  >
                    {budgetBuckets
                      .filter(
                        (bucket) =>
                          !bucket.isArchived ||
                          bucket.id === transactionEditDraft.budgetBucketId,
                      )
                      .map((bucket) => (
                        <option key={bucket.id} value={bucket.id}>
                          {bucket.icon} {bucket.name}
                          {bucket.isArchived ? ' (보관됨)' : ''}
                        </option>
                      ))}
                  </select>
                  <span className="dashboard-select-chevron" aria-hidden="true">
                    ⌄
                  </span>
                </span>
              </label>
              <p className="transaction-edit-bucket-hint">
                기존 거래와 새 불러오기는 생활비로 시작합니다. 실제 자금 목적에 맞게 바꿔 주세요.
              </p>
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
              <section
                className="transaction-edit-attachment"
                aria-labelledby={`transaction-edit-attachment-title-${editingTransaction.id}`}
              >
                <div className="transaction-edit-attachment__heading">
                  <div>
                    <strong
                      id={`transaction-edit-attachment-title-${editingTransaction.id}`}
                    >
                      거래 이미지
                    </strong>
                    <small>영수증이나 거래를 기억할 사진을 이 기기에만 보관해요.</small>
                  </div>
                  {isLoadingTransactionAttachment ? (
                    <span role="status">불러오는 중</span>
                  ) : null}
                </div>
                {visibleTransactionAttachment === undefined ? (
                  <div className="transaction-edit-attachment__empty">
                    아직 추가한 이미지가 없어요.
                  </div>
                ) : (
                  <div className="transaction-edit-attachment__preview">
                    <img
                      src={visibleTransactionAttachment.dataUrl}
                      alt={`${editingTransaction.descriptionOriginal} 거래 이미지 미리보기`}
                    />
                    <span>{visibleTransactionAttachment.fileName}</span>
                  </div>
                )}
                <div className="transaction-edit-attachment__actions">
                  <label className="transaction-edit-attachment__upload">
                    <input
                      type="file"
                      accept="image/*"
                      aria-label={`${editingTransaction.descriptionOriginal} 거래 이미지 추가`}
                      disabled={isSavingTransactionEdit}
                      onChange={(event) => void handleTransactionImageChange(event)}
                    />
                    {visibleTransactionAttachment === undefined
                      ? '이미지 추가'
                      : '이미지 변경'}
                  </label>
                  {visibleTransactionAttachment === undefined ? null : (
                    <button
                      type="button"
                      onClick={removeTransactionImage}
                      disabled={isSavingTransactionEdit}
                    >
                      이미지 삭제
                    </button>
                  )}
                </div>
              </section>
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
