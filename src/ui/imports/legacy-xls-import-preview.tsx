import { useRef, useState } from 'react';

import type {
  ImportCandidate,
  ImportIssue,
  ImportPreview,
  ImportSource,
} from '../../domain/imports/legacy-xls-preview';
import type { LegacyXlsPreviewReader } from '../../application/imports/prepare-legacy-xls-import';
import type {
  LegacyXlsImportConfirmationResult,
  LegacyXlsImportConfirmationOptions,
} from '../../application/imports/confirm-legacy-xls-import';
import type { DuplicateCandidateMatch } from '../../domain/imports/duplicate-candidates';
import {
  CATEGORY_IDS,
  type CategoryId,
} from '../../domain/categories/category';
import type { TransactionType } from '../../domain/transactions/transaction';
import type { PlaceSearch, PlaceSearchResult } from '../../application/places/place-search';
import type {
  AccountTransactionTypeClassification,
  AccountTransactionTypeClassificationReasonCode,
} from '../../domain/transactions/account-transaction-type-classifier';
import { formatWon } from '../../shared/format/currency';

type ImportStatus = 'IDLE' | 'READING' | 'PREVIEW' | 'SAVING' | 'SAVED';
type PlaceSearchState = Readonly<{
  status: 'SEARCHING' | 'COMPLETE' | 'FAILED';
  results: readonly PlaceSearchResult[];
}>;

export type LegacyXlsImportPreviewProps = Readonly<{
  previewFile: LegacyXlsPreviewReader;
  applyCategoryRules?: (preview: ImportPreview) => Promise<ImportPreview>;
  findPotentialDuplicates?: (
    preview: ImportPreview,
  ) => Promise<readonly DuplicateCandidateMatch[]>;
  confirmPreview?: (
    preview: ImportPreview,
    options?: LegacyXlsImportConfirmationOptions,
  ) => Promise<LegacyXlsImportConfirmationResult>;
  onImportConfirmed?: () => void;
  searchPlaces?: PlaceSearch;
}>;

const SOURCE_LABELS: Readonly<Record<ImportSource, string>> = {
  ACCOUNT_LEDGER_XLS: '계좌 거래 XLS',
  CARD_USAGE_XLS: '카드 이용 XLS',
};

const CATEGORY_LABELS: Readonly<Record<CategoryId, string>> = {
  FOOD_DINING: '식비·외식',
  TRANSPORT: '교통',
  HOUSING_UTILITIES: '주거·공과금',
  SHOPPING: '쇼핑',
  HEALTH: '건강',
  EDUCATION: '교육',
  LEISURE: '여가',
  SUBSCRIPTION: '구독',
  OTHER: '기타',
};

function withCategoryId(
  candidate: ImportCandidate,
  categoryId: CategoryId | undefined,
): ImportCandidate {
  const { categoryId: ignoredCategoryId, ...draftWithoutCategory } = candidate.draft;
  void ignoredCategoryId;

  return {
    ...candidate,
    draft:
      candidate.draft.type !== 'EXPENSE' || categoryId === undefined
        ? draftWithoutCategory
        : { ...draftWithoutCategory, categoryId },
  };
}

function getCandidateTypeLabel(type: TransactionType): string {
  const labels: Readonly<Record<TransactionType, string>> = {
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
    UNKNOWN: '검토 필요',
  };

  return labels[type];
}

function getClassificationReasonLabel(
  reasonCode: AccountTransactionTypeClassificationReasonCode,
): string {
  const labels: Readonly<
    Record<AccountTransactionTypeClassificationReasonCode, string>
  > = {
    card_payment_keyword: '카드대금 표식',
    savings_keyword: '저축 표식',
    loan_payment_keyword: '대출상환 표식',
    investment_keyword: '투자 표식',
    transfer_keyword: '이체 표식',
    income_keyword: '수입 표식',
    reward_keyword: '리워드 표식',
    no_matching_rule: '일치 규칙 없음',
  };

  return labels[reasonCode];
}

function getClassificationLabel(
  classification: AccountTransactionTypeClassification,
): string {
  return `계좌 규칙 · ${
    classification.confidence === 'HIGH' ? '높은 확신' : '검토 필요'
  } · ${getClassificationReasonLabel(classification.reasonCode)}`;
}

function getIssueLabel(issue: ImportIssue): string {
  const rowLabel = issue.rowNumber === undefined ? '파일 전체' : `${issue.rowNumber}행`;

  return `${rowLabel} · ${issue.message}`;
}

function getPreviewSummary(preview: ImportPreview): string {
  const sourceLabel =
    preview.source === undefined ? '지원하지 않는 파일' : SOURCE_LABELS[preview.source];

  return `${sourceLabel} · 후보 ${preview.candidates.length}건 · 확인 필요 ${preview.issues.length}건`;
}

export function LegacyXlsImportPreview({
  previewFile,
  applyCategoryRules,
  findPotentialDuplicates,
  confirmPreview,
  onImportConfirmed,
  searchPlaces,
}: LegacyXlsImportPreviewProps) {
  const [status, setStatus] = useState<ImportStatus>('IDLE');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<
    readonly DuplicateCandidateMatch[]
  >([]);
  const [selectedCandidateIndexes, setSelectedCandidateIndexes] = useState<
    ReadonlySet<number>
  >(new Set());
  const [duplicateCheckFailed, setDuplicateCheckFailed] = useState(false);
  const [categoryIdByCandidateIndex, setCategoryIdByCandidateIndex] = useState<
    ReadonlyMap<number, CategoryId | undefined>
  >(new Map());
  const [categoryRuleCandidateIndexes, setCategoryRuleCandidateIndexes] = useState<
    ReadonlySet<number>
  >(new Set());
  const [openCategoryPickerIndex, setOpenCategoryPickerIndex] = useState<number | null>(
    null,
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [placeSearchByCandidateIndex, setPlaceSearchByCandidateIndex] = useState<
    ReadonlyMap<number, PlaceSearchState>
  >(new Map());
  const requestIdRef = useRef(0);

  const resetPreview = () => {
    requestIdRef.current += 1;
    setStatus('IDLE');
    setPreview(null);
    setDuplicateMatches([]);
    setSelectedCandidateIndexes(new Set());
    setDuplicateCheckFailed(false);
    setCategoryIdByCandidateIndex(new Map());
    setCategoryRuleCandidateIndexes(new Set());
    setOpenCategoryPickerIndex(null);
    setSaveMessage(null);
    setPlaceSearchByCandidateIndex(new Map());
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';

    if (file === undefined) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('READING');
    setPreview(null);
    setDuplicateMatches([]);
    setSelectedCandidateIndexes(new Set());
    setDuplicateCheckFailed(false);
    setCategoryIdByCandidateIndex(new Map());
    setCategoryRuleCandidateIndexes(new Set());
    setOpenCategoryPickerIndex(null);
    setSaveMessage(null);
    setPlaceSearchByCandidateIndex(new Map());

    try {
      const parsedPreview = await previewFile(file);
      const nextPreview =
        applyCategoryRules === undefined
          ? parsedPreview
          : await applyCategoryRules(parsedPreview);
      let nextDuplicateMatches: readonly DuplicateCandidateMatch[] = [];
      let didDuplicateCheckFail = false;

      try {
        nextDuplicateMatches =
          findPotentialDuplicates === undefined
            ? []
            : await findPotentialDuplicates(nextPreview);
      } catch {
        didDuplicateCheckFail = true;
      }

      if (requestId === requestIdRef.current) {
        const duplicateCandidateIndexes = new Set(
          nextDuplicateMatches.map((match) => match.candidateIndex),
        );
        setPreview(nextPreview);
        setDuplicateMatches(nextDuplicateMatches);
        setSelectedCandidateIndexes(
          new Set(
            nextPreview.candidates.flatMap((_, candidateIndex) =>
              duplicateCandidateIndexes.has(candidateIndex) ? [] : [candidateIndex],
            ),
          ),
        );
        setCategoryIdByCandidateIndex(
          new Map(
            nextPreview.candidates.flatMap((candidate, candidateIndex) =>
              candidate.draft.type === 'EXPENSE'
                ? [[candidateIndex, candidate.draft.categoryId] as const]
                : [],
            ),
          ),
        );
        setDuplicateCheckFailed(didDuplicateCheckFail);
        setStatus('PREVIEW');
        if (searchPlaces !== undefined) {
          nextPreview.candidates.forEach((candidate, candidateIndex) => {
            if (candidate.draft.type === 'EXPENSE') {
              void searchCandidatePlace(
                candidateIndex,
                candidate.draft.descriptionOriginal,
              );
            }
          });
        }
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setPreview({
          candidates: [],
          issues: [
            {
              code: 'unsupported_file',
              message: '파일을 읽는 중 문제가 발생했습니다.',
            },
          ],
        });
        setStatus('PREVIEW');
      }
    }
  };

  const handleConfirm = async () => {
    if (
      preview === null ||
      confirmPreview === undefined ||
      duplicateCheckFailed
    ) {
      return;
    }

    const selectedCandidates = preview.candidates.flatMap(
      (candidate, candidateIndex) =>
        selectedCandidateIndexes.has(candidateIndex)
          ? [
              withCategoryId(
                candidate,
                categoryIdByCandidateIndex.get(candidateIndex),
              ),
            ]
          : [],
    );

    if (selectedCandidates.length === 0) {
      setSaveMessage('저장할 후보를 하나 이상 선택해 주세요.');
      return;
    }

    setStatus('SAVING');
    setSaveMessage(null);
    let result: LegacyXlsImportConfirmationResult;
    try {
      const categoryRuleRequests = preview.candidates.flatMap(
        (candidate, candidateIndex) => {
          const categoryId = categoryIdByCandidateIndex.get(candidateIndex);

          return selectedCandidateIndexes.has(candidateIndex) &&
            candidate.draft.type === 'EXPENSE' &&
            categoryRuleCandidateIndexes.has(candidateIndex) &&
            categoryId !== undefined
            ? [
                {
                  descriptionOriginal: candidate.draft.descriptionOriginal,
                  categoryId,
                },
              ]
            : [];
        },
      );
      result = await confirmPreview(
        { ...preview, candidates: selectedCandidates },
        {
          skippedCount: preview.candidates.length - selectedCandidates.length,
          ...(categoryRuleRequests.length === 0 ? {} : { categoryRuleRequests }),
        },
      );
    } catch {
      setStatus('PREVIEW');
      setSaveMessage('로컬 저장에 실패했습니다. 기존 저장 거래는 변경되지 않았습니다.');
      return;
    }

    if (result.isConfirmed) {
      setStatus('SAVED');
      setSaveMessage(`${result.transactions.length}건을 이 기기에 저장했습니다.`);
      onImportConfirmed?.();
      return;
    }

    if (
      result.code === 'invalid_category_rule' ||
      result.code === 'conflicting_category_rule'
    ) {
      setStatus('PREVIEW');
      setSaveMessage('카테고리 규칙을 다시 확인해 주세요. 같은 거래 설명에는 한 가지 카테고리만 저장할 수 있습니다.');
      return;
    }

    setStatus('PREVIEW');
    setSaveMessage(
      result.code === 'nothing_to_save'
        ? '저장할 수 있는 후보가 없습니다.'
        : '로컬 저장에 실패했습니다. 기존 저장 거래는 변경되지 않았습니다.',
    );
  };

  const toggleCandidateSelection = (candidateIndex: number) => {
    setSelectedCandidateIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);

      if (nextIndexes.has(candidateIndex)) {
        nextIndexes.delete(candidateIndex);
      } else {
        nextIndexes.add(candidateIndex);
      }

      return nextIndexes;
    });
  };

  const includeAllPotentialDuplicates = () => {
    setSelectedCandidateIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);
      duplicateMatches.forEach((match) => nextIndexes.add(match.candidateIndex));
      return nextIndexes;
    });
  };

  const updateCandidateCategory = (
    candidateIndex: number,
    categoryId: CategoryId | undefined,
  ) => {
    setCategoryIdByCandidateIndex((currentCategories) => {
      const nextCategories = new Map(currentCategories);
      nextCategories.set(candidateIndex, categoryId);
      return nextCategories;
    });

    if (categoryId === undefined) {
      setCategoryRuleCandidateIndexes((currentIndexes) => {
        const nextIndexes = new Set(currentIndexes);
        nextIndexes.delete(candidateIndex);
        return nextIndexes;
      });
    }
    setOpenCategoryPickerIndex(null);
  };

  const toggleCategoryPicker = (candidateIndex: number) => {
    setOpenCategoryPickerIndex((currentIndex) =>
      currentIndex === candidateIndex ? null : candidateIndex,
    );
  };

  const toggleCategoryRule = (candidateIndex: number) => {
    if (categoryIdByCandidateIndex.get(candidateIndex) === undefined) {
      return;
    }

    setCategoryRuleCandidateIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);

      if (nextIndexes.has(candidateIndex)) {
        nextIndexes.delete(candidateIndex);
      } else {
        nextIndexes.add(candidateIndex);
      }

      return nextIndexes;
    });
  };

  const searchCandidatePlace = async (
    candidateIndex: number,
    descriptionOriginal: string,
  ) => {
    if (searchPlaces === undefined) {
      return;
    }

    setPlaceSearchByCandidateIndex((current) => {
      const next = new Map(current);
      next.set(candidateIndex, { status: 'SEARCHING', results: [] });
      return next;
    });

    try {
      const results = await searchPlaces(descriptionOriginal);
      setPlaceSearchByCandidateIndex((current) => {
        const next = new Map(current);
        next.set(candidateIndex, { status: 'COMPLETE', results });
        return next;
      });
    } catch {
      setPlaceSearchByCandidateIndex((current) => {
        const next = new Map(current);
        next.set(candidateIndex, { status: 'FAILED', results: [] });
        return next;
      });
    }
  };

  const duplicateCandidateMatches =
    preview === null
      ? []
      : duplicateMatches.filter(
          (match) => preview.candidates[match.candidateIndex] !== undefined,
        );
  const selectedCandidateCount = selectedCandidateIndexes.size;

  return (
    <div className="legacy-import-preview" id="import">
      <span className="status-pill">사용 가능 · Preview</span>
      <p className="panel-kicker">LOCAL XLS IMPORT</p>
      <h3 id="import-title">내 XLS 파일 미리보기</h3>
      <p>
        계좌 거래와 카드 이용내역을 브라우저 안에서 읽습니다. Preview 후 사용자가
        확인한 후보만 이 기기에 저장합니다.
      </p>

      <div className="import-flow" aria-label="현재 가져오기 흐름">
        <span>파일 선택</span>
        <i aria-hidden="true">→</i>
        <span>미리보기</span>
        <i aria-hidden="true">→</i>
        <span>저장 전 확인</span>
      </div>

      <label className="import-file-action">
        <input
          type="file"
          accept=".xls,application/vnd.ms-excel"
          aria-label="XLS 파일 선택"
          onChange={handleFileChange}
        />
        <span>{status === 'READING' ? '파일 읽는 중…' : 'XLS 파일 선택'}</span>
      </label>

      {status === 'READING' ? (
        <p className="import-reading" role="status" aria-live="polite">
          파일을 이 기기 안에서 확인하고 있습니다.
        </p>
      ) : null}

      {preview !== null ? (
        <section className="import-preview-result" aria-labelledby="import-result-title">
          <div className="import-preview-heading">
            <div>
              <span className="step-label">PREVIEW</span>
              <h4 id="import-result-title">가져오기 검토</h4>
            </div>
            <button type="button" className="import-clear-action" onClick={resetPreview}>
              지우기
            </button>
          </div>

          <p className="import-preview-summary" role="status" aria-live="polite">
            {getPreviewSummary(preview)}
          </p>

          {duplicateCheckFailed ? (
            <p className="duplicate-check-error" role="alert">
              저장된 거래와 중복 가능성을 비교하지 못했습니다. 파일을 다시 선택한 뒤 확인해 주세요.
            </p>
          ) : null}

          {duplicateCandidateMatches.length > 0 ? (
            <section className="duplicate-candidate-review" aria-labelledby="duplicate-review-title">
              <div>
                <strong id="duplicate-review-title">중복 가능 후보 {duplicateCandidateMatches.length}건</strong>
                <p>
                  저장 거래 또는 이 파일의 앞선 후보와 정확한 비교 키가 같습니다. 실제 별도 거래일 수 있어 기본 저장에서만 제외했습니다.
                </p>
              </div>
              <button
                type="button"
                className="duplicate-include-all-action"
                onClick={includeAllPotentialDuplicates}
                disabled={
                  status === 'SAVING' ||
                  status === 'SAVED' ||
                  duplicateCandidateMatches.every((match) =>
                    selectedCandidateIndexes.has(match.candidateIndex),
                  )
                }
              >
                중복 가능 후보 모두 저장에 포함
              </button>
              <ul aria-label="중복 가능 Import 후보">
                {duplicateCandidateMatches.map((match) => {
                  const candidate = preview.candidates[match.candidateIndex];

                  if (candidate === undefined) {
                    return null;
                  }

                  return (
                    <li key={`${candidate.source}-${candidate.rowNumber}`}>
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`중복 가능 후보 ${match.candidateIndex + 1} 저장`}
                          checked={selectedCandidateIndexes.has(match.candidateIndex)}
                          disabled={status === 'SAVING' || status === 'SAVED'}
                          onChange={() => toggleCandidateSelection(match.candidateIndex)}
                        />
                        <span>
                          <strong>{candidate.draft.descriptionOriginal}</strong>
                          <small>
                            {candidate.draft.occurredOn} · {formatWon(candidate.draft.amountMinor)} · 저장 전 사용자 확인 필요
                          </small>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {preview.candidates.length > 0 ? (
            <ul className="import-candidate-list" aria-label="가져오기 후보">
              {preview.candidates.map((candidate, candidateIndex) => {
                const selectedCategoryId = categoryIdByCandidateIndex.get(candidateIndex);
                const isCategoryPickerOpen = openCategoryPickerIndex === candidateIndex;
                const isCandidateSelected = selectedCandidateIndexes.has(candidateIndex);
                const isExpenseCandidate = candidate.draft.type === 'EXPENSE';
                const placeSearchState = placeSearchByCandidateIndex.get(candidateIndex);

                return (
                <li key={`${candidate.source}-${candidate.rowNumber}`}>
                  <span className="import-candidate-date">{candidate.draft.occurredOn}</span>
                  <strong>{candidate.draft.descriptionOriginal}</strong>
                  <span className="import-candidate-meta">
                    {getCandidateTypeLabel(candidate.draft.type)} ·{' '}
                    {candidate.draft.direction === 'INFLOW' ? '입금' : '출금'}
                    {candidate.draft.paymentInstrumentLabel === undefined
                      ? ''
                      : ` · ${candidate.draft.paymentInstrumentLabel}`}
                  </span>
                  {candidate.accountTypeClassification === undefined ? null : (
                    <small className="import-classification-meta">
                      분류: {getClassificationLabel(candidate.accountTypeClassification)}
                    </small>
                  )}
                  <span className="import-candidate-amount">
                    {candidate.draft.direction === 'INFLOW' ? '+' : '−'}
                    {formatWon(candidate.draft.amountMinor)}
                  </span>
                  {isExpenseCandidate ? (
                    <>
                  {searchPlaces === undefined ? (
                    <small className="import-category-rule-help">
                      Kakao 장소 검색은 이 기기의 환경 설정 후 사용할 수 있어요.
                    </small>
                  ) : (
                    <div className="import-place-search">
                      <small>
                        파일 업로드 시 이 거래 설명을 Kakao로 자동 분석하며, 결과는 저장하지 않아요.
                      </small>
                      {placeSearchState === undefined ||
                      placeSearchState.status === 'SEARCHING' ? (
                        <small>Kakao 장소 분석 중</small>
                      ) : null}
                      {placeSearchState?.status === 'FAILED' ? (
                        <>
                          <small role="alert">장소 검색을 불러오지 못했어요. 설정과 네트워크를 확인해 주세요.</small>
                          <button
                            type="button"
                            onClick={() =>
                              void searchCandidatePlace(
                                candidateIndex,
                                candidate.draft.descriptionOriginal,
                              )
                            }
                          >
                            Kakao 장소 분석 다시 시도
                          </button>
                        </>
                      ) : null}
                      {placeSearchState?.status === 'COMPLETE' ? (
                        placeSearchState.results.length === 0 ? (
                          <small>일치하는 장소가 없어요. 결과는 저장하지 않습니다.</small>
                        ) : (
                          <ul aria-label={`후보 ${candidateIndex + 1} Kakao 장소 검색 결과`}>
                            {placeSearchState.results.map((place) => (
                              <li key={place.id}>{place.name} · {place.address}</li>
                            ))}
                          </ul>
                        )
                      ) : null}
                    </div>
                  )}
                  <div className="import-category-picker">
                    <span>카테고리</span>
                    <button
                      type="button"
                      className={
                        selectedCategoryId === undefined
                          ? 'import-category-trigger is-unclassified'
                          : 'import-category-trigger'
                      }
                      aria-controls={`candidate-category-picker-${candidateIndex}`}
                      aria-expanded={isCategoryPickerOpen}
                      aria-label={`후보 ${candidateIndex + 1} 카테고리 ${
                        isCategoryPickerOpen ? '닫기' : '열기'
                      }`}
                      disabled={status === 'SAVING' || status === 'SAVED'}
                      onClick={() => toggleCategoryPicker(candidateIndex)}
                    >
                      <strong>
                        {selectedCategoryId === undefined
                          ? '미분류'
                          : CATEGORY_LABELS[selectedCategoryId]}
                      </strong>
                      <span>{isCategoryPickerOpen ? '닫기' : '변경'}</span>
                    </button>
                    {candidate.draft.categoryId === undefined ? (
                      <small>이번 저장에만 카테고리를 붙일 수 있어요.</small>
                    ) : (
                      <small>저장된 규칙으로 채워졌으며 바꿀 수 있어요.</small>
                    )}
                    {isCategoryPickerOpen ? (
                      <div
                        className="import-category-options"
                        id={`candidate-category-picker-${candidateIndex}`}
                        role="group"
                        aria-label={`후보 ${candidateIndex + 1} 카테고리 선택`}
                      >
                        <button
                          type="button"
                          className={
                            selectedCategoryId === undefined
                              ? 'is-active category-quick-option'
                              : 'category-quick-option'
                          }
                          aria-pressed={selectedCategoryId === undefined}
                          onClick={() =>
                            updateCandidateCategory(candidateIndex, undefined)
                          }
                        >
                          미분류
                        </button>
                        {CATEGORY_IDS.map((categoryId) => (
                          <button
                            type="button"
                            className={
                              selectedCategoryId === categoryId
                                ? 'is-active category-quick-option'
                                : 'category-quick-option'
                            }
                            aria-pressed={selectedCategoryId === categoryId}
                            key={categoryId}
                            onClick={() =>
                              updateCandidateCategory(candidateIndex, categoryId)
                            }
                          >
                            {CATEGORY_LABELS[categoryId]}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <label className="import-category-rule">
                    <input
                      type="checkbox"
                      aria-label={`후보 ${candidateIndex + 1} 카테고리 규칙 저장`}
                      checked={categoryRuleCandidateIndexes.has(candidateIndex)}
                      disabled={
                        status === 'SAVING' ||
                        status === 'SAVED' ||
                        !isCandidateSelected ||
                        selectedCategoryId === undefined
                      }
                      onChange={() => toggleCategoryRule(candidateIndex)}
                    />
                    <span>이 설명을 다음에도 기억</span>
                  </label>
                    </>
                  ) : (
                    <small className="import-category-rule-help">
                      카테고리는 지출 유형에서만 지정할 수 있어요.
                    </small>
                  )}
                  {!isCandidateSelected ? (
                    <small className="import-category-rule-help">
                      중복 가능 후보는 저장 대상으로 다시 선택해야 규칙을 기억할 수 있어요.
                    </small>
                  ) : null}
                </li>
                );
              })}
            </ul>
          ) : null}

          {preview.issues.length > 0 ? (
            <div className="import-issue-list" role="alert">
              <strong>자동 반영하지 않은 항목</strong>
              <ul>
                {preview.issues.slice(0, 6).map((issue, index) => (
                  <li key={`${issue.code}-${issue.rowNumber ?? 'file'}-${index}`}>
                    {getIssueLabel(issue)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {confirmPreview !== undefined && preview.candidates.length > 0 ? (
            <div className="import-confirmation">
              <button
                type="button"
                className="import-confirm-action"
                data-testid="import-confirm-action"
                onClick={handleConfirm}
                disabled={
                  status === 'SAVING' ||
                  status === 'SAVED' ||
                  duplicateCheckFailed ||
                  selectedCandidateCount === 0
                }
              >
                {status === 'SAVING'
                  ? '이 기기에 저장하는 중'
                  : status === 'SAVED'
                    ? '저장 완료'
                    : `후보 ${preview.candidates.length}건을 이 기기에 저장`}
              </button>
              <p className="import-selection-note">
                현재 {selectedCandidateCount}건만 저장 대상으로 선택되었습니다. 중복 가능 후보는 체크하거나 전체 포함을 눌러야 저장됩니다.
              </p>
              <p className="import-confirmation-note">
                원본 XLS와 파일명은 저장하지 않으며, 저장 후 기간별 장부에서 확인할 수 있습니다.
              </p>
            </div>
          ) : null}

          {saveMessage !== null ? (
            <p className="import-save-message" role="status">
              {saveMessage}
            </p>
          ) : null}

          <small>원본 파일과 파일명은 저장하지 않습니다.</small>
        </section>
      ) : null}
    </div>
  );
}
