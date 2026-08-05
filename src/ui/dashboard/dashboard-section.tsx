import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  LegacyXlsImportConfirmationOptions,
  LegacyXlsImportConfirmationResult,
} from '../../application/imports/confirm-legacy-xls-import';
import type { DuplicateCandidateMatch } from '../../domain/imports/duplicate-candidates';
import type { LegacyXlsPreviewReader } from '../../application/imports/prepare-legacy-xls-import';
import { saveManualBudgetSettlement } from '../../application/ledger/save-manual-budget-settlement';
import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import type { BudgetSettlement } from '../../domain/transactions/budget-settlement';
import { calculateLivingExpenseSummary } from '../../domain/transactions/living-expense';
import {
  getTransactionDateRange,
  type TransactionPeriodPreset,
} from '../../domain/transactions/transaction-period';
import type { Transaction } from '../../domain/transactions/transaction';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';
import { BrowserLedgerRepository } from '../../infrastructure/storage/browser-ledger-repository';
import { formatWon } from '../../shared/format/currency';
import {
  dashboardMockSummary,
  dashboardMockTransactions,
} from './dashboard-fixtures';
import { LegacyXlsImportPreview } from '../imports/legacy-xls-import-preview';

type DashboardMode = 'LOCAL' | 'MOCK';

export type LocalLedgerRepository = Pick<
  BrowserLedgerRepository,
  | 'listTransactionsInRange'
  | 'listAllTransactions'
  | 'getTransactionsByIds'
  | 'listBudgetSettlements'
  | 'saveBudgetSettlement'
  | 'removeBudgetSettlement'
>;

type DashboardSectionProps = Readonly<{
  previewLegacyXls: LegacyXlsPreviewReader;
  confirmLegacyXlsImport: (
    preview: ImportPreview,
    options?: LegacyXlsImportConfirmationOptions,
  ) => Promise<LegacyXlsImportConfirmationResult>;
  findPotentialLegacyXlsImportDuplicates: (
    preview: ImportPreview,
  ) => Promise<readonly DuplicateCandidateMatch[]>;
  ledgerRepository: LocalLedgerRepository;
}>;

type SettlementNotice = Readonly<{
  tone: 'success' | 'error';
  message: string;
}>;

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

function getTransactionTypeLabel(type: Transaction['type']): string {
  const labels: Readonly<Record<Transaction['type'], string>> = {
    EXPENSE: '지출',
    INCOME: '수입',
    TRANSFER: '이체',
    CARD_PAYMENT: '카드대금',
    SAVING: '저축',
    INVESTMENT: '투자',
    LOAN_PAYMENT: '대출 상환',
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

export function DashboardSection({
  previewLegacyXls,
  confirmLegacyXlsImport,
  findPotentialLegacyXlsImportDuplicates,
  ledgerRepository,
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [payerTransactionId, setPayerTransactionId] = useState('');
  const [reimbursementTransactionIds, setReimbursementTransactionIds] = useState<
    readonly string[]
  >([]);
  const [settlementNotice, setSettlementNotice] = useState<SettlementNotice | null>(
    null,
  );
  const isMock = mode === 'MOCK';
  const rangeResult = useMemo(
    () =>
      getTransactionDateRange(preset, anchorOn, {
        startOn: customStartOn,
        endOn: customEndOn,
      }),
    [anchorOn, customEndOn, customStartOn, preset],
  );

  const requestReload = useCallback(() => {
    setReloadVersion((version) => version + 1);
  }, []);

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
    ])
      .then(([rangeTransactions, nextAllTransactions, nextSettlements]) => {
        if (!isCurrent) {
          return;
        }
        setTransactions(rangeTransactions);
        setAllTransactions(nextAllTransactions);
        setSettlements(nextSettlements);
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }
        setTransactions([]);
        setAllTransactions([]);
        setSettlements([]);
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
  const totalIncome = transactions
    .filter((transaction) => transaction.direction === 'INFLOW')
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
  const totalOutflow = transactions
    .filter((transaction) => transaction.direction === 'OUTFLOW')
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
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

  return (
    <section className="ledger-section" id="ledger" aria-labelledby="ledger-title">
      <div className="section-heading ledger-heading">
        <div>
          <p className="eyebrow">LOCAL LEDGER</p>
          <h2 id="ledger-title">저장한 거래를 기간별로 확인하세요</h2>
          <p>
            XLS를 확인한 뒤 저장한 거래만 이 기기에서 조회합니다. 원본 파일과 파일명은 저장하지 않습니다.
          </p>
        </div>

        <div className="view-switch" aria-label="장부 보기 선택">
          <button
            type="button"
            className={!isMock ? 'is-active' : undefined}
            aria-pressed={!isMock}
            onClick={() => setMode('LOCAL')}
          >
            빈 장부
          </button>
          <button
            type="button"
            className={isMock ? 'is-active' : undefined}
            aria-pressed={isMock}
            onClick={() => setMode('MOCK')}
          >
            예시 데이터 보기
          </button>
        </div>
      </div>

      {isMock ? (
        <div className="mock-notice" role="status">
          <span aria-hidden="true">M</span>
          Mock Data · 아래 금액과 거래는 화면 확인을 위한 가짜 데이터입니다.
        </div>
      ) : null}

      {!isMock ? (
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

      <div className="ledger-grid">
        <div className="ledger-main">
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
          </div>

          <article className="transactions-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">{isMock ? 'RECENT' : 'SAVED · LOCAL'}</p>
                <h3>{isMock ? '최근 거래' : '선택 기간 거래'}</h3>
              </div>
              <span>
                {isMock
                  ? '3건 · Mock'
                  : isLoading
                    ? '불러오는 중'
                    : `${transactions.length}건 · 로컬`}
              </span>
            </div>

            {isMock ? (
              <ul className="transaction-list">
                {dashboardMockTransactions.map((transaction) => (
                  <li key={transaction.id}>
                    <span className="transaction-mark" aria-hidden="true">
                      {transaction.direction === 'IN' ? '+' : '−'}
                    </span>
                    <span className="transaction-copy">
                      <strong>{transaction.description}</strong>
                      <small>{transaction.category}</small>
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
            ) : transactions.length > 0 ? (
              <ul className="transaction-list">
                {transactions.map((transaction) => (
                  <li key={transaction.id}>
                    <span className="transaction-mark" aria-hidden="true">
                      {transaction.direction === 'INFLOW' ? '+' : '−'}
                    </span>
                    <span className="transaction-copy">
                      <strong>{transaction.descriptionOriginal}</strong>
                      <small>
                        {transaction.occurredOn} · {getTransactionTypeLabel(transaction.type)}
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
                ))}
              </ul>
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
                  {loadError ? (
                    <p className="ledger-load-error">
                      이 브라우저의 로컬 저장소를 열지 못했습니다. 개인정보는 전송되지 않았습니다.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </article>

          {!isMock ? (
            <article className="settlement-panel" aria-labelledby="settlement-title">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">SHARED PAYMENT</p>
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
        </div>

        <aside className="import-card import-card--active" aria-labelledby="import-title">
          <LegacyXlsImportPreview
            previewFile={previewLegacyXls}
            confirmPreview={confirmLegacyXlsImport}
            findPotentialDuplicates={findPotentialLegacyXlsImportDuplicates}
            onImportConfirmed={requestReload}
          />
        </aside>
      </div>
    </section>
  );
}
