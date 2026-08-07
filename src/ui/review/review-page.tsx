import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { updateTransactionDetails } from '../../application/ledger/update-transaction-details';
import {
  CATEGORY_IDS,
  type CategoryId,
} from '../../domain/categories/category';
import { getCategoryPresentation } from '../../domain/categories/category-presentation';
import {
  isCategoryReviewNeededTransaction,
  isTransactionTypeReviewNeeded,
} from '../../domain/transactions/review-needed';
import type { Transaction } from '../../domain/transactions/transaction';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';
import { BrowserLedgerRepository } from '../../infrastructure/storage/browser-ledger-repository';
import { formatWon } from '../../shared/format/currency';

import './review-page.css';

export type ReviewLedgerRepository = Pick<
  BrowserLedgerRepository,
  'listAllTransactions' | 'getTransactionsByIds' | 'replaceTransaction'
>;

type ReviewPageProps = Readonly<{
  ledgerRepository: ReviewLedgerRepository;
}>;

type ReviewLoadState = 'LOADING' | 'READY' | 'ERROR';

function currentUtcIsoInstant(): UtcIsoInstant {
  return new Date().toISOString() as UtcIsoInstant;
}

function sortReviewTransactions(
  transactions: readonly Transaction[],
): readonly Transaction[] {
  return [...transactions].sort(
    (left, right) =>
      left.occurredOn.localeCompare(right.occurredOn) ||
      left.createdAt.localeCompare(right.createdAt),
  );
}

function getNextTransactionId(
  transactions: readonly Transaction[],
  activeTransactionId: string,
): string | undefined {
  const activeIndex = transactions.findIndex(
    (transaction) => transaction.id === activeTransactionId,
  );

  if (activeIndex < 0 || transactions.length < 2) {
    return undefined;
  }

  return transactions[(activeIndex + 1) % transactions.length]?.id;
}

export function ReviewPage({ ledgerRepository }: ReviewPageProps) {
  const [loadState, setLoadState] = useState<ReviewLoadState>('LOADING');
  const [transactions, setTransactions] = useState<readonly Transaction[]>([]);
  const [activeTransactionId, setActiveTransactionId] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const requestIdRef = useRef(0);

  const loadTransactions = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoadState('LOADING');
    setNotice(undefined);

    try {
      const nextTransactions = await ledgerRepository.listAllTransactions();

      if (requestId !== requestIdRef.current) {
        return;
      }

      setTransactions(sortReviewTransactions(nextTransactions));
      setLoadState('READY');
    } catch {
      if (requestId === requestIdRef.current) {
        setLoadState('ERROR');
      }
    }
  }, [ledgerRepository]);

  useEffect(() => {
    void loadTransactions();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadTransactions]);

  const categoryReviewTransactions = useMemo(
    () => transactions.filter(isCategoryReviewNeededTransaction),
    [transactions],
  );
  const transactionTypeReviewCount = useMemo(
    () => transactions.filter(isTransactionTypeReviewNeeded).length,
    [transactions],
  );

  useEffect(() => {
    setActiveTransactionId((current) =>
      current !== undefined &&
      categoryReviewTransactions.some((transaction) => transaction.id === current)
        ? current
        : categoryReviewTransactions[0]?.id,
    );
  }, [categoryReviewTransactions]);

  const activeTransaction =
    categoryReviewTransactions.find(
      (transaction) => transaction.id === activeTransactionId,
    ) ?? categoryReviewTransactions[0];
  const activePosition =
    activeTransaction === undefined
      ? 0
      : categoryReviewTransactions.findIndex(
            (transaction) => transaction.id === activeTransaction.id,
          ) + 1;

  const handleCategorySelect = async (categoryId: CategoryId) => {
    if (activeTransaction === undefined || isSaving) {
      return;
    }

    const nextTransactionId = getNextTransactionId(
      categoryReviewTransactions,
      activeTransaction.id,
    );
    const category = getCategoryPresentation(categoryId);
    setIsSaving(true);
    setNotice(undefined);

    const result = await updateTransactionDetails(
      {
        transactionId: activeTransaction.id,
        categoryId,
        memo: activeTransaction.memo,
        updatedAt: currentUtcIsoInstant(),
      },
      ledgerRepository,
    );

    if (!result.isUpdated) {
      setIsSaving(false);
      setNotice(
        '카테고리를 저장하지 못했습니다. 이 기기의 저장소를 확인한 뒤 다시 시도해 주세요.',
      );
      return;
    }

    setTransactions((current) =>
      current.map((transaction) =>
        transaction.id === result.transaction.id ? result.transaction : transaction,
      ),
    );
    setActiveTransactionId(nextTransactionId);
    setIsSaving(false);
    setNotice(
      `${category.emoji} ${category.label} 카테고리로 저장하고 다음 거래를 열었어요.`,
    );
  };

  const handleSkip = () => {
    if (activeTransaction === undefined) {
      return;
    }

    const nextTransactionId = getNextTransactionId(
      categoryReviewTransactions,
      activeTransaction.id,
    );

    if (nextTransactionId === undefined) {
      return;
    }

    setActiveTransactionId(nextTransactionId);
    setNotice('다음 거래를 열었어요. 저장하지 않은 분류는 그대로 남아 있습니다.');
  };

  return (
    <section className="review-page" aria-labelledby="review-page-title">
      <header className="review-page__header">
        <p className="review-page__eyebrow">차근차근 정리하기</p>
        <h1 id="review-page-title">분류 검토</h1>
        <p>
          카테고리 하나를 누르면 이 거래에만 저장하고 다음 미분류 지출로 넘어가요.
        </p>
      </header>

      {loadState === 'LOADING' ? (
        <div className="review-page__state" role="status" aria-live="polite">
          <span className="review-page__spinner" aria-hidden="true" />
          <strong>분류할 거래를 불러오는 중이에요</strong>
          <p>이 기기에 저장한 거래만 확인하고 있습니다.</p>
        </div>
      ) : null}

      {loadState === 'ERROR' ? (
        <div className="review-page__state review-page__state--error" role="alert">
          <strong>분류할 거래를 불러오지 못했어요</strong>
          <p>로컬 저장소를 다시 확인해 주세요. 개인정보는 외부로 전송되지 않았습니다.</p>
          <button type="button" onClick={() => void loadTransactions()}>
            다시 시도
          </button>
        </div>
      ) : null}

      {loadState === 'READY' ? (
        <>
          <section className="review-page__summary" aria-label="분류 검토 현황">
            <span>카테고리 분류</span>
            <strong>{categoryReviewTransactions.length}건</strong>
            <small>카테고리가 없는 지출만 한 건씩 정리합니다.</small>
          </section>

          {activeTransaction === undefined ? (
            <section className="review-page__complete" aria-labelledby="review-complete-title">
              <span aria-hidden="true">✓</span>
              <div>
                <h2 id="review-complete-title">카테고리 분류가 모두 끝났어요</h2>
                <p>새 거래를 불러오거나 거래 내역에서 기존 분류를 다시 바꿀 수 있어요.</p>
              </div>
              <a href="/transactions">거래 내역 보기</a>
            </section>
          ) : (
            <section
              className="review-queue-card"
              aria-labelledby="review-queue-title"
              aria-busy={isSaving}
            >
              <div className="review-queue-card__heading">
                <div>
                  <p>카테고리 분류</p>
                  <h2 id="review-queue-title">
                    {categoryReviewTransactions.length}건 중 {activePosition}번째
                  </h2>
                </div>
                <span>{isSaving ? '저장 중' : '한 건씩'}</span>
              </div>
              <div
                className="review-queue-card__progress"
                role="progressbar"
                aria-label="현재 분류 순서"
                aria-valuemin={1}
                aria-valuemax={categoryReviewTransactions.length}
                aria-valuenow={activePosition}
              >
                <span
                  style={{
                    width: `${Math.max(
                      4,
                      Math.round(
                        (activePosition / categoryReviewTransactions.length) * 100,
                      ),
                    )}%`,
                  }}
                />
              </div>

              <article className="review-transaction-card review-transaction-card--expense">
                <span className="review-transaction-card__direction">지출</span>
                <h3>{activeTransaction.descriptionOriginal}</h3>
                <strong>−{formatWon(activeTransaction.amountMinor)}</strong>
                <p>
                  {activeTransaction.occurredOn} · {activeTransaction.type === 'EXPENSE' ? '지출' : '확인 필요'}
                  {activeTransaction.paymentInstrumentLabel === undefined
                    ? ''
                    : ` · ${activeTransaction.paymentInstrumentLabel}`}
                </p>
              </article>

              <div className="review-category-grid" aria-label="카테고리 선택">
                {CATEGORY_IDS.map((categoryId) => {
                  const category = getCategoryPresentation(categoryId);

                  return (
                    <button
                      type="button"
                      className="review-category-action"
                      disabled={isSaving}
                      key={categoryId}
                      onClick={() => void handleCategorySelect(categoryId)}
                    >
                      <span aria-hidden="true">{category.emoji}</span>
                      <strong>{category.label}</strong>
                    </button>
                  );
                })}
              </div>

              <div className="review-queue-card__footer">
                <p>카테고리를 누르면 바로 저장됩니다. 금액·날짜·거래 유형은 바뀌지 않아요.</p>
                <button
                  type="button"
                  disabled={isSaving || categoryReviewTransactions.length < 2}
                  onClick={handleSkip}
                >
                  지금은 건너뛰기
                </button>
              </div>
            </section>
          )}

          {notice === undefined ? null : (
            <p className="review-page__notice" role="status" aria-live="polite">
              {notice}
            </p>
          )}

          {transactionTypeReviewCount > 0 ? (
            <aside className="review-type-note" aria-labelledby="review-type-note-title">
              <span aria-hidden="true">!</span>
              <div>
                <h2 id="review-type-note-title">
                  거래 성격 확인 {transactionTypeReviewCount}건
                </h2>
                <p>
                  이 거래들은 카테고리가 아니라 수입·이체·카드대금 같은 거래 유형을 먼저 확인해야 해요. 이 화면에서는 유형을 바꾸지 않습니다.
                </p>
              </div>
              <a href="/transactions">거래 내역에서 보기</a>
            </aside>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
