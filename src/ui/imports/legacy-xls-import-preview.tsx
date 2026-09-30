import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';

import type {
  ImportCandidate,
  ImportIssue,
  ImportPreview,
  ImportSource,
} from '../../domain/imports/legacy-xls-preview';
import type {
  LatestLocalFinanceXlsPicker,
  LocalFinanceDirectoryPickResult,
} from '../../application/imports/local-finance-directory-import';
import type { LegacyXlsPreviewReader } from '../../application/imports/prepare-legacy-xls-import';
import type {
  LegacyXlsImportConfirmationResult,
  LegacyXlsImportConfirmationOptions,
} from '../../application/imports/confirm-legacy-xls-import';
import type { DuplicateCandidateMatch } from '../../domain/imports/duplicate-candidates';
import {
  CATEGORY_IDS,
  type BuiltInCategoryId,
  type CategoryId,
} from '../../domain/categories/category';
import type { CustomCategory } from '../../domain/categories/custom-category';
import { normalizeCategoryRuleDescription } from '../../domain/categories/category-rule';
import {
  DEFAULT_BUDGET_BUCKETS,
  type BudgetBucket,
  type BudgetBucketId,
} from '../../domain/budget-buckets/budget-bucket';
import type { TransactionType } from '../../domain/transactions/transaction';
import type { PlaceSearch, PlaceSearchResult } from '../../application/places/place-search';
import {
  analyzeMerchantWithKakao,
  type MerchantKakaoAnalysis,
} from '../../application/places/analyze-merchant-with-kakao';
import type { KakaoPlaceCategoryClassification } from '../../domain/categories/kakao-place-category-classifier';
import type {
  AccountTransactionTypeClassification,
  AccountTransactionTypeClassificationReasonCode,
} from '../../domain/transactions/account-transaction-type-classifier';
import { formatWon } from '../../shared/format/currency';
import { CategoryCreateForm } from '../shared/category-create-form';

type ImportStatus = 'IDLE' | 'READING' | 'PREVIEW' | 'SAVING' | 'SAVED';
type PlaceSearchState = Readonly<{
  status: 'SEARCHING' | 'COMPLETE' | 'FAILED' | 'SKIPPED';
  results: readonly PlaceSearchResult[];
  classification?: KakaoPlaceCategoryClassification;
  analysis?: MerchantKakaoAnalysis;
  userRuleCategoryId?: CategoryId;
}>;

type CandidatePlaceSearchRequest = Readonly<{
  candidateIndex: number;
  descriptionOriginal: string;
}>;

const MAX_CONCURRENT_KAKAO_ANALYSES = 3;
const EMPTY_CUSTOM_CATEGORIES: readonly CustomCategory[] = [];

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
  budgetBuckets?: readonly BudgetBucket[];
  customCategories?: readonly CustomCategory[];
  onCreateCategory?: (
    name: string,
    emoji: string,
  ) => Promise<CustomCategory | undefined>;
  onViewSavedTransactions?: () => void;
  pickLatestLocalFinanceXls?: LatestLocalFinanceXlsPicker;
}>;

type CandidateDescriptionGroup = Readonly<{
  key: string;
  label: string;
  candidateIndexes: readonly number[];
  totalAmountMinor: number;
}>;

const MIXED_CATEGORY_VALUE = '__MIXED__';
const MAX_VISIBLE_IMPORT_ISSUES = 6;

function groupExpenseCandidatesByDescription(
  candidates: readonly ImportCandidate[],
): readonly CandidateDescriptionGroup[] {
  const groups = new Map<string, { label: string; candidateIndexes: number[]; totalAmountMinor: number }>();

  candidates.forEach((candidate, candidateIndex) => {
    if (candidate.draft.type !== 'EXPENSE') {
      return;
    }

    const key = normalizeCategoryRuleDescription(candidate.draft.descriptionOriginal);
    if (key.length === 0) {
      return;
    }

    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        label: candidate.draft.descriptionOriginal,
        candidateIndexes: [candidateIndex],
        totalAmountMinor: candidate.draft.amountMinor,
      });
      return;
    }

    group.candidateIndexes.push(candidateIndex);
    group.totalAmountMinor += candidate.draft.amountMinor;
  });

  return Array.from(groups, ([key, group]) => ({ key, ...group }))
    .filter((group) => group.candidateIndexes.length >= 2)
    .sort(
      (left, right) =>
        right.candidateIndexes.length - left.candidateIndexes.length ||
        left.label.localeCompare(right.label, 'ko'),
    );
}

function needsClassification(
  candidate: ImportCandidate,
  categoryId: CategoryId | undefined,
): boolean {
  return (
    candidate.draft.type === 'UNKNOWN' ||
    (candidate.draft.type === 'EXPENSE' && categoryId === undefined)
  );
}

const SOURCE_LABELS: Readonly<Record<ImportSource, string>> = {
  ACCOUNT_LEDGER_XLS: '계좌 거래 XLS',
  CARD_USAGE_XLS: '카드 이용 XLS',
};

const CATEGORY_LABELS: Readonly<Record<BuiltInCategoryId, string>> = {
  FOOD_DINING: '식비·외식',
  CAFE: '카페',
  CONVENIENCE: '편의점',
  TRANSPORT: '교통',
  HOUSING_UTILITIES: '주거·공과금',
  SHOPPING: '쇼핑',
  HEALTH: '건강',
  EDUCATION: '교육',
  LEISURE: '여가',
  CULTURE: '문화',
  MEDICAL: '의료',
  DATE: '데이트',
  SUBSCRIPTION: '구독',
  OTHER: '기타',
};

const CATEGORY_SYMBOLS: Readonly<Record<BuiltInCategoryId, string>> = {
  FOOD_DINING: '🍽️',
  CAFE: '☕',
  CONVENIENCE: '🏪',
  TRANSPORT: '🚌',
  HOUSING_UTILITIES: '🏠',
  SHOPPING: '🛍️',
  HEALTH: '🌿',
  EDUCATION: '📚',
  LEISURE: '🎮',
  CULTURE: '🎫',
  MEDICAL: '🩺',
  DATE: '💜',
  SUBSCRIPTION: '🔁',
  OTHER: '•••',
};

function getCategoryLabel(
  categoryId: CategoryId | undefined,
  customCategories: readonly CustomCategory[],
): string {
  if (categoryId === undefined) {
    return '미분류';
  }

  return (
    CATEGORY_LABELS[categoryId as BuiltInCategoryId] ??
    customCategories.find((category) => category.id === categoryId)?.name ??
    '사용자 카테고리'
  );
}

function getCategorySymbol(
  categoryId: CategoryId | undefined,
  customCategories: readonly CustomCategory[],
): string {
  if (categoryId === undefined) {
    return '?';
  }

  return (
    CATEGORY_SYMBOLS[categoryId as BuiltInCategoryId] ??
    customCategories.find((category) => category.id === categoryId)?.emoji ??
    '🏷️'
  );
}

type CandidateDetails = Readonly<{
  categoryId: CategoryId | undefined;
  budgetBucketId: BudgetBucketId;
  memo: string;
}>;

function withCandidateDetails(
  candidate: ImportCandidate,
  details: CandidateDetails,
): ImportCandidate {
  const {
    categoryId: ignoredCategoryId,
    budgetBucketId: ignoredBudgetBucketId,
    memo: ignoredMemo,
    ...draftWithoutDetails
  } = candidate.draft;
  void ignoredCategoryId;
  void ignoredBudgetBucketId;
  void ignoredMemo;

  return {
    ...candidate,
    draft: {
      ...draftWithoutDetails,
      budgetBucketId: details.budgetBucketId,
      ...(candidate.draft.type !== 'EXPENSE' || details.categoryId === undefined
        ? {}
        : { categoryId: details.categoryId }),
      ...(details.memo.trim().length === 0 ? {} : { memo: details.memo.trim() }),
    },
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

function MerchantAnalysisTrace({
  analysis,
  customCategories,
}: Readonly<{
  analysis: MerchantKakaoAnalysis;
  customCategories: readonly CustomCategory[];
}>) {
  const { resolution, trace } = analysis;

  return (
    <details className="import-merchant-trace">
      <summary>상세 분석 과정 (개발자용)</summary>
      <div>
        <small>원본: {trace.original}</small>
        <small>정제: {trace.normalized || '없음'}</small>
        <small>
          해석: {trace.resolutionSource} · {resolution.confidence}
        </small>
        {trace.matchedAlias === undefined ? null : (
          <small>
            Alias: {trace.matchedAlias} → {trace.canonicalQuery}
          </small>
        )}
        <small>Canonical: {trace.canonicalQuery || '없음'}</small>
        {trace.attempts.length === 0 ? (
          <small>검색: 외부 호출 없음</small>
        ) : (
          <ol aria-label="Kakao 검색 시도">
            {trace.attempts.map((attempt) => (
              <li key={`${attempt.kind}-${attempt.query}`}>
                {attempt.kind}: {attempt.query} · 결과 {attempt.resultCount}건
              </li>
            ))}
          </ol>
        )}
        {trace.matchedPlaceName === undefined ? null : (
          <small>Kakao 장소: {trace.matchedPlaceName}</small>
        )}
        {trace.kakaoCategoryName === undefined ? null : (
          <small>Kakao 카테고리: {trace.kakaoCategoryName}</small>
        )}
        {trace.mappedCategoryId === undefined ? null : (
          <small>
            내부 카테고리: {getCategoryLabel(trace.mappedCategoryId, customCategories)}
          </small>
        )}
        {trace.finalReviewReason === undefined ? null : (
          <small>최종 검토 사유: {trace.finalReviewReason}</small>
        )}
      </div>
    </details>
  );
}

function ImportFileIllustration() {
  return (
    <div className="import-file-illustration" aria-hidden="true">
      <span className="import-file-illustration__halo" />
      <svg viewBox="0 0 96 96" focusable="false">
        <path
          d="M31 15h25l17 17v44a7 7 0 0 1-7 7H31a7 7 0 0 1-7-7V22a7 7 0 0 1 7-7Z"
          fill="currentColor"
        />
        <path d="M56 15v17h17" fill="none" stroke="white" strokeWidth="5" />
        <path
          d="M48 66V41m0 0-10 10m10-10 10 10"
          fill="none"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
      </svg>
      <span className="import-file-illustration__receipt">
        <svg viewBox="0 0 32 32" focusable="false">
          <path
            d="M8 4h16v24l-4-2-4 2-4-2-4 2V4Zm4 7h8m-8 5h8m-8 5h5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
          />
        </svg>
      </span>
    </div>
  );
}

export function LegacyXlsImportPreview({
  previewFile,
  applyCategoryRules,
  findPotentialDuplicates,
  confirmPreview,
  onImportConfirmed,
  searchPlaces,
  budgetBuckets = DEFAULT_BUDGET_BUCKETS,
  customCategories: providedCustomCategories = EMPTY_CUSTOM_CATEGORIES,
  onCreateCategory,
  onViewSavedTransactions,
  pickLatestLocalFinanceXls,
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
  const [budgetBucketIdByCandidateIndex, setBudgetBucketIdByCandidateIndex] =
    useState<ReadonlyMap<number, BudgetBucketId>>(new Map());
  const [memoByCandidateIndex, setMemoByCandidateIndex] = useState<
    ReadonlyMap<number, string>
  >(new Map());
  const [categoryRuleCandidateIndexes, setCategoryRuleCandidateIndexes] = useState<
    ReadonlySet<number>
  >(new Set());
  const [openCategoryPickerIndex, setOpenCategoryPickerIndex] = useState<number | null>(
    null,
  );
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [placeSearchByCandidateIndex, setPlaceSearchByCandidateIndex] = useState<
    ReadonlyMap<number, PlaceSearchState>
  >(new Map());
  const [isDropActive, setIsDropActive] = useState(false);
  const [localFolderMessage, setLocalFolderMessage] = useState<string | null>(null);
  // Preview를 읽은 시점에 분류가 필요했던 후보는 분류 뒤에도 같은 자리에 남긴다.
  const [reviewFirstCandidateIndexes, setReviewFirstCandidateIndexes] = useState<
    ReadonlySet<number>
  >(new Set());
  const [customCategories, setCustomCategories] = useState<
    readonly CustomCategory[]
  >(providedCustomCategories);
  const requestIdRef = useRef(0);
  const savedNoticeRef = useRef<HTMLDivElement | null>(null);
  const kakaoAbortControllerRef = useRef<AbortController | null>(null);
  const categoryPickerRef = useRef<HTMLDivElement | null>(null);
  const categoryTriggerRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(
    () => () => {
      kakaoAbortControllerRef.current?.abort();
      requestIdRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    setCustomCategories(providedCustomCategories);
  }, [providedCustomCategories]);

  useEffect(() => {
    if (status === 'SAVED') {
      savedNoticeRef.current?.focus();
    }
  }, [status]);

  useEffect(() => {
    if (openCategoryPickerIndex === null) {
      return;
    }

    const trigger = categoryTriggerRefs.current.get(openCategoryPickerIndex);
    const activeOption =
      categoryPickerRef.current?.querySelector<HTMLButtonElement>(
        '.category-quick-option[aria-pressed="true"]',
      ) ??
      categoryPickerRef.current?.querySelector<HTMLButtonElement>(
        '.category-quick-option',
      );
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    activeOption?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const focusableElements = Array.from(
          categoryPickerRef.current?.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)',
          ) ?? [],
        );
        const firstFocusableElement = focusableElements[0];
        const lastFocusableElement = focusableElements.at(-1);

        if (
          firstFocusableElement !== undefined &&
          lastFocusableElement !== undefined &&
          ((!event.shiftKey && document.activeElement === lastFocusableElement) ||
            (event.shiftKey && document.activeElement === firstFocusableElement))
        ) {
          event.preventDefault();
          (event.shiftKey ? lastFocusableElement : firstFocusableElement).focus();
        }
        return;
      }

      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      setOpenCategoryPickerIndex(null);
      trigger?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openCategoryPickerIndex]);

  const resetPreview = () => {
    kakaoAbortControllerRef.current?.abort();
    kakaoAbortControllerRef.current = null;
    requestIdRef.current += 1;
    setStatus('IDLE');
    setPreview(null);
    setDuplicateMatches([]);
    setSelectedCandidateIndexes(new Set());
    setDuplicateCheckFailed(false);
    setCategoryIdByCandidateIndex(new Map());
    setBudgetBucketIdByCandidateIndex(new Map());
    setMemoByCandidateIndex(new Map());
    setCategoryRuleCandidateIndexes(new Set());
    setOpenCategoryPickerIndex(null);
    setIsCreatingCategory(false);
    setSaveMessage(null);
    setPlaceSearchByCandidateIndex(new Map());
    setIsDropActive(false);
    setLocalFolderMessage(null);
    setReviewFirstCandidateIndexes(new Set());
  };

  const processFile = async (file: File) => {
    if (file === undefined) {
      return;
    }

    setLocalFolderMessage(null);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    kakaoAbortControllerRef.current?.abort();
    const kakaoAbortController = new AbortController();
    kakaoAbortControllerRef.current = kakaoAbortController;
    setStatus('READING');
    setPreview(null);
    setDuplicateMatches([]);
    setSelectedCandidateIndexes(new Set());
    setDuplicateCheckFailed(false);
    setCategoryIdByCandidateIndex(new Map());
    setBudgetBucketIdByCandidateIndex(new Map());
    setMemoByCandidateIndex(new Map());
    setCategoryRuleCandidateIndexes(new Set());
    setOpenCategoryPickerIndex(null);
    setSaveMessage(null);
    setPlaceSearchByCandidateIndex(new Map());
    setReviewFirstCandidateIndexes(new Set());

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
        setReviewFirstCandidateIndexes(
          new Set(
            nextPreview.candidates.flatMap((candidate, candidateIndex) =>
              needsClassification(candidate, candidate.draft.categoryId)
                ? [candidateIndex]
                : [],
            ),
          ),
        );
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
        setBudgetBucketIdByCandidateIndex(
          new Map(
            nextPreview.candidates.map((candidate, candidateIndex) => [
              candidateIndex,
              candidate.draft.budgetBucketId,
            ]),
          ),
        );
        setMemoByCandidateIndex(
          new Map(
            nextPreview.candidates.map((candidate, candidateIndex) => [
              candidateIndex,
              candidate.draft.memo ?? '',
            ]),
          ),
        );
        setDuplicateCheckFailed(didDuplicateCheckFail);
        setStatus('PREVIEW');
        if (searchPlaces !== undefined) {
          const queuedSearches: CandidatePlaceSearchRequest[] = [];

          nextPreview.candidates.forEach((candidate, candidateIndex) => {
            if (candidate.draft.type !== 'EXPENSE') {
              return;
            }

            if (candidate.draft.categoryId !== undefined) {
              setPlaceSearchByCandidateIndex((current) => {
                const next = new Map(current);
                next.set(candidateIndex, {
                  status: 'SKIPPED',
                  results: [],
                  userRuleCategoryId: candidate.draft.categoryId,
                });
                return next;
              });
              return;
            }

            queuedSearches.push({
              candidateIndex,
              descriptionOriginal: candidate.draft.descriptionOriginal,
            });
          });

          void searchCandidatePlaces(
            queuedSearches,
            requestId,
            kakaoAbortController.signal,
          );
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';

    if (file !== undefined) {
      void processFile(file);
    }
  };

  const handleFileDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDropActive(false);

    if (status === 'SAVING') {
      return;
    }

    const file = event.dataTransfer.files[0];
    if (file !== undefined) {
      void processFile(file);
    }
  };

  const handleLocalFinanceFolderImport = async () => {
    if (pickLatestLocalFinanceXls === undefined || status === 'READING' || status === 'SAVING') {
      return;
    }

    setLocalFolderMessage(null);

    let result: LocalFinanceDirectoryPickResult;
    try {
      result = await pickLatestLocalFinanceXls();
    } catch {
      // 권한 거부·읽기 실패 원인에 경로가 담길 수 있어 일반화된 안내만 보여 준다.
      setLocalFolderMessage('폴더를 읽지 못했습니다. 파일 선택하기로 계속할 수 있습니다.');
      return;
    }

    if (result.status === 'CANCELLED') {
      return;
    }

    if (result.status === 'EMPTY') {
      setLocalFolderMessage('선택한 폴더에서 XLS 파일을 찾지 못했습니다.');
      return;
    }

    await processFile(result.file);
  };

  const handleConfirm = async () => {
    const hasPendingKakaoAnalysis = Array.from(
      placeSearchByCandidateIndex.values(),
    ).some((placeSearchState) => placeSearchState.status === 'SEARCHING');

    if (
      preview === null ||
      confirmPreview === undefined ||
      duplicateCheckFailed ||
      hasPendingKakaoAnalysis
    ) {
      return;
    }

    const selectedCandidates = preview.candidates.flatMap(
      (candidate, candidateIndex) =>
        selectedCandidateIndexes.has(candidateIndex)
          ? [
              withCandidateDetails(
                candidate,
                {
                  categoryId: categoryIdByCandidateIndex.get(candidateIndex),
                  budgetBucketId:
                    budgetBucketIdByCandidateIndex.get(candidateIndex) ??
                    candidate.draft.budgetBucketId,
                  memo: memoByCandidateIndex.get(candidateIndex) ?? '',
                },
              ),
            ]
          : [],
    );

    if (selectedCandidates.length === 0) {
      setSaveMessage('저장할 후보를 하나 이상 선택해 주세요.');
      return;
    }

    const confirmationRequestId = requestIdRef.current;
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
      if (confirmationRequestId !== requestIdRef.current) {
        return;
      }

      setStatus('PREVIEW');
      setSaveMessage('로컬 저장에 실패했습니다. 기존 저장 거래는 변경되지 않았습니다.');
      return;
    }

    if (confirmationRequestId !== requestIdRef.current) {
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
    categoryTriggerRefs.current.get(candidateIndex)?.focus();
  };

  const updateCandidateBudgetBucket = (
    candidateIndex: number,
    budgetBucketId: BudgetBucketId,
  ) => {
    setBudgetBucketIdByCandidateIndex((currentBuckets) => {
      const nextBuckets = new Map(currentBuckets);
      nextBuckets.set(candidateIndex, budgetBucketId);
      return nextBuckets;
    });
  };

  const updateCandidateMemo = (candidateIndex: number, memo: string) => {
    setMemoByCandidateIndex((currentMemos) => {
      const nextMemos = new Map(currentMemos);
      nextMemos.set(candidateIndex, memo);
      return nextMemos;
    });
  };

  const updateGroupCategory = (
    candidateIndexes: readonly number[],
    categoryId: CategoryId | undefined,
  ) => {
    setCategoryIdByCandidateIndex((currentCategories) => {
      const nextCategories = new Map(currentCategories);
      candidateIndexes.forEach((candidateIndex) =>
        nextCategories.set(candidateIndex, categoryId),
      );
      return nextCategories;
    });

    if (categoryId === undefined) {
      setCategoryRuleCandidateIndexes((currentIndexes) => {
        const nextIndexes = new Set(currentIndexes);
        candidateIndexes.forEach((candidateIndex) => nextIndexes.delete(candidateIndex));
        return nextIndexes;
      });
    }
  };

  const updateGroupCategoryRule = (
    candidateIndexes: readonly number[],
    shouldRemember: boolean,
  ) => {
    setCategoryRuleCandidateIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);
      candidateIndexes.forEach((candidateIndex) => {
        if (
          shouldRemember &&
          selectedCandidateIndexes.has(candidateIndex) &&
          categoryIdByCandidateIndex.get(candidateIndex) !== undefined
        ) {
          nextIndexes.add(candidateIndex);
        } else {
          nextIndexes.delete(candidateIndex);
        }
      });
      return nextIndexes;
    });
  };

  const toggleCategoryPicker = (candidateIndex: number) => {
    if (openCategoryPickerIndex === candidateIndex) {
      setOpenCategoryPickerIndex(null);
      categoryTriggerRefs.current.get(candidateIndex)?.focus();
      return;
    }

    setOpenCategoryPickerIndex(candidateIndex);
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
    previewRequestId = requestIdRef.current,
    signal = kakaoAbortControllerRef.current?.signal,
  ) => {
    if (searchPlaces === undefined) {
      return;
    }

    const isActivePreview = () =>
      previewRequestId === requestIdRef.current && signal?.aborted !== true;

    if (isActivePreview()) {
      setPlaceSearchByCandidateIndex((current) => {
        const next = new Map(current);
        next.set(candidateIndex, { status: 'SEARCHING', results: [] });
        return next;
      });
    }

    try {
      const analysis = await analyzeMerchantWithKakao(
        descriptionOriginal,
        searchPlaces,
        { ...(signal === undefined ? {} : { signal }) },
      );

      if (!isActivePreview()) {
        return;
      }

      const { classification, results } = analysis;
      setPlaceSearchByCandidateIndex((current) => {
        const next = new Map(current);
        next.set(candidateIndex, {
          status:
            classification.source === 'NOT_QUERIED' ? 'SKIPPED' : 'COMPLETE',
          results,
          classification,
          analysis,
        });
        return next;
      });
      if (classification.status === 'CLASSIFIED') {
        setCategoryIdByCandidateIndex((current) => {
          if (
            !isActivePreview() ||
            current.get(candidateIndex) !== undefined
          ) {
            return current;
          }
          const next = new Map(current);
          next.set(candidateIndex, classification.categoryId);
          return next;
        });
      }
    } catch {
      if (!isActivePreview()) {
        return;
      }

      setPlaceSearchByCandidateIndex((current) => {
        const next = new Map(current);
        next.set(candidateIndex, { status: 'FAILED', results: [] });
        return next;
      });
    }
  };

  const searchCandidatePlaces = async (
    requests: readonly CandidatePlaceSearchRequest[],
    previewRequestId: number,
    signal: AbortSignal,
  ) => {
    let nextRequestIndex = 0;

    const runWorker = async () => {
      while (
        previewRequestId === requestIdRef.current &&
        !signal.aborted
      ) {
        const request = requests[nextRequestIndex];
        nextRequestIndex += 1;

        if (request === undefined) {
          return;
        }

        await searchCandidatePlace(
          request.candidateIndex,
          request.descriptionOriginal,
          previewRequestId,
          signal,
        );
      }
    };

    await Promise.all(
      Array.from(
        {
          length: Math.min(MAX_CONCURRENT_KAKAO_ANALYSES, requests.length),
        },
        () => runWorker(),
      ),
    );
  };

  const duplicateCandidateMatches =
    preview === null
      ? []
      : duplicateMatches.filter(
          (match) => preview.candidates[match.candidateIndex] !== undefined,
        );
  const selectedCandidateCount = selectedCandidateIndexes.size;
  const duplicateCandidateCount = new Set(
    duplicateCandidateMatches.map((match) => match.candidateIndex),
  ).size;
  const newCandidateCount =
    preview === null || duplicateCheckFailed
      ? null
      : Math.max(0, preview.candidates.length - duplicateCandidateCount);
  const classificationNeededCount =
    preview === null
      ? 0
      : preview.candidates.filter((candidate, candidateIndex) =>
          needsClassification(candidate, categoryIdByCandidateIndex.get(candidateIndex)),
        ).length;
  const excludedIssueCount = preview?.issues.length ?? 0;
  const excludedIssueNotice =
    excludedIssueCount === 0
      ? ''
      : ` 자동 반영하지 않은 항목 ${excludedIssueCount}건은 따로 확인해 주세요.`;
  const candidateDescriptionGroups =
    preview === null ? [] : groupExpenseCandidatesByDescription(preview.candidates);
  const isSaved = status === 'SAVED';
  const reviewFirstCandidateCount = reviewFirstCandidateIndexes.size;
  const kakaoAnalysisPendingCount = Array.from(
    placeSearchByCandidateIndex.values(),
  ).filter((placeSearchState) => placeSearchState.status === 'SEARCHING').length;
  const isBusy =
    status === 'READING' || status === 'SAVING' || kakaoAnalysisPendingCount > 0;

  const renderCandidate = (candidate: ImportCandidate, candidateIndex: number) => {
                const selectedCategoryId = categoryIdByCandidateIndex.get(candidateIndex);
                const isCategoryPickerOpen = openCategoryPickerIndex === candidateIndex;
                const isCandidateSelected = selectedCandidateIndexes.has(candidateIndex);
                const isExpenseCandidate = candidate.draft.type === 'EXPENSE';
                const budgetBucket =
                  budgetBuckets.find(
                    (bucket) =>
                      bucket.id ===
                      (budgetBucketIdByCandidateIndex.get(candidateIndex) ??
                        candidate.draft.budgetBucketId),
                  ) ?? undefined;
                const placeSearchState = placeSearchByCandidateIndex.get(candidateIndex);

                return (
                <li
                  className={isCandidateSelected ? undefined : 'is-excluded'}
                  key={`${candidate.source}-${candidate.rowNumber}`}
                >
                  <div className="import-candidate-heading">
                    <span className="import-candidate-symbol" aria-hidden="true">
                      {selectedCategoryId === undefined
                        ? isExpenseCandidate
                          ? '?'
                          : candidate.draft.direction === 'INFLOW'
                            ? '+'
                            : '₩'
                        : getCategorySymbol(selectedCategoryId, customCategories)}
                    </span>
                    <div className="import-candidate-copy">
                      <span className="import-candidate-date">
                        {candidate.draft.occurredOn}
                      </span>
                      <strong>{candidate.draft.descriptionOriginal}</strong>
                      <span className="import-candidate-meta">
                        {getCandidateTypeLabel(candidate.draft.type)} ·{' '}
                        {candidate.draft.direction === 'INFLOW' ? '입금' : '출금'}
                        {candidate.draft.paymentInstrumentLabel === undefined
                          ? ''
                          : ` · ${candidate.draft.paymentInstrumentLabel}`}
                      </span>
                    </div>
                    <span className="import-candidate-amount">
                      {candidate.draft.direction === 'INFLOW' ? '+' : '−'}
                      {formatWon(candidate.draft.amountMinor)}
                    </span>
                  </div>
                  {candidate.accountTypeClassification === undefined ? null : (
                    <small className="import-classification-meta">
                      분류: {getClassificationLabel(candidate.accountTypeClassification)}
                    </small>
                  )}
                  <small className="import-classification-meta">
                    돈의 목적: {budgetBucket?.icon ?? '🗂️'}{' '}
                    {budgetBucket?.name ?? candidate.draft.budgetBucketId} · 기본 추천
                  </small>
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
                                requestIdRef.current,
                                kakaoAbortControllerRef.current?.signal,
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
                              <li key={place.id}>
                                {place.placeName} · {place.categoryName} ·{' '}
                                {place.roadAddressName.length > 0
                                  ? place.roadAddressName
                                  : place.addressName}
                                <small>
                                  그룹: {place.categoryGroupName || place.categoryGroupCode || '없음'} ·
                                  지번: {place.addressName || '없음'} · 도로명:{' '}
                                  {place.roadAddressName || '없음'}
                                </small>
                              </li>
                            ))}
                          </ul>
                        )
                      ) : null}
                      {placeSearchState?.userRuleCategoryId === undefined ? null : candidate.categorySource === 'DEFAULT_KEYWORD' ? (
                        <small>
                          기본 추천 →{' '}
                          {getCategoryLabel(
                            placeSearchState.userRuleCategoryId,
                            customCategories,
                          )}{' '}
                          · DEFAULT_KEYWORD
                        </small>
                      ) : (
                        <small>
                          사용자 규칙 →{' '}
                          {getCategoryLabel(
                            placeSearchState.userRuleCategoryId,
                            customCategories,
                          )}{' '}
                          · USER_RULE · HIGH
                        </small>
                      )}
                      {placeSearchState?.classification?.status === 'CLASSIFIED' ? (
                        <small>
                          {placeSearchState.classification.place.placeName} ·{' '}
                          {placeSearchState.classification.place.categoryName} →{' '}
                          {getCategoryLabel(
                            placeSearchState.classification.categoryId,
                            customCategories,
                          )}{' '}
                          ·{' '}
                          {placeSearchState.classification.source} ·{' '}
                          {placeSearchState.classification.confidence}
                        </small>
                      ) : null}
                      {placeSearchState?.classification?.status === 'NEEDS_REVIEW' ? (
                        <small>
                          {placeSearchState.classification.reason === 'PAYMENT_INTERMEDIARY'
                            ? '결제 중개자 표식이라 Kakao 자동 분석에서 제외했습니다. 검토가 필요합니다.'
                            : placeSearchState.classification.reason === 'NO_EXACT_MERCHANT_MATCH'
                              ? 'Kakao 결과와 같은 Merchant로 확인되지 않아 검토가 필요합니다.'
                              : 'Kakao 카테고리를 내부 분류로 안전하게 매핑할 수 없어 검토가 필요합니다.'}{' '}
                          · {placeSearchState.classification.source} ·{' '}
                          {placeSearchState.classification.confidence}
                        </small>
                      ) : null}
                      {placeSearchState?.analysis === undefined ? null : (
                        <MerchantAnalysisTrace
                          analysis={placeSearchState.analysis}
                          customCategories={customCategories}
                        />
                      )}
                    </div>
                  )}
                  <div className="import-category-picker">
                    <span className="import-category-picker__label">카테고리</span>
                    <button
                      type="button"
                      ref={(element) => {
                        if (element === null) {
                          categoryTriggerRefs.current.delete(candidateIndex);
                        } else {
                          categoryTriggerRefs.current.set(candidateIndex, element);
                        }
                      }}
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
                      disabled={status === 'SAVING'}
                      onClick={() => toggleCategoryPicker(candidateIndex)}
                    >
                      <strong>
                        {selectedCategoryId === undefined
                          ? '미분류'
                          : getCategoryLabel(selectedCategoryId, customCategories)}
                      </strong>
                      <span className="import-category-trigger__affordance">
                        {isCategoryPickerOpen ? '닫기' : '선택'}
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path
                            d="m7 9 5 5 5-5"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                      </span>
                    </button>
                    {candidate.draft.categoryId === undefined ? (
                      <small>선택한 카테고리는 우선 이번 거래에만 반영해요.</small>
                    ) : candidate.categorySource === 'DEFAULT_KEYWORD' ? (
                      <small>자주 쓰는 상호라 기본 추천으로 채웠어요. 다르면 바꿔 주세요.</small>
                    ) : (
                      <small>기억한 규칙으로 채웠어요. 언제든 바꿀 수 있어요.</small>
                    )}
                    {isCategoryPickerOpen ? (
                      <div className="import-category-sheet-layer">
                        <button
                          type="button"
                          className="import-category-sheet-backdrop"
                          aria-label="카테고리 선택 창 닫기"
                          onClick={() => toggleCategoryPicker(candidateIndex)}
                        />
                        <div
                          ref={categoryPickerRef}
                          className="import-category-options"
                          id={`candidate-category-picker-${candidateIndex}`}
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby={`candidate-category-title-${candidateIndex}`}
                          aria-describedby={`candidate-category-context-${candidateIndex}`}
                        >
                          <div className="import-category-sheet-heading">
                            <span aria-hidden="true" />
                            <div>
                              <small>분류가 필요한 거래</small>
                              <strong id={`candidate-category-title-${candidateIndex}`}>
                                어디에 사용하셨나요?
                              </strong>
                              <div
                                className="import-candidate-copy"
                                id={`candidate-category-context-${candidateIndex}`}
                              >
                                <strong>{candidate.draft.descriptionOriginal}</strong>
                                <span className="import-candidate-meta">
                                  {candidate.draft.occurredOn} ·{' '}
                                  {candidate.draft.direction === 'INFLOW' ? '+' : '−'}
                                  {formatWon(candidate.draft.amountMinor)}
                                  {candidate.draft.paymentInstrumentLabel === undefined
                                    ? ''
                                    : ` · ${candidate.draft.paymentInstrumentLabel}`}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="import-category-sheet-close"
                              aria-label="카테고리 선택 닫기"
                              onClick={() => toggleCategoryPicker(candidateIndex)}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path
                                  d="m7 7 10 10M17 7 7 17"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeWidth="2"
                                />
                              </svg>
                            </button>
                          </div>
                          <div
                            className="import-category-option-grid"
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
                              <span aria-hidden="true">?</span>
                              <strong>미분류</strong>
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
                                <span aria-hidden="true">
                                  {getCategorySymbol(categoryId, customCategories)}
                                </span>
                                <strong>
                                  {getCategoryLabel(categoryId, customCategories)}
                                </strong>
                              </button>
                            ))}
                            {customCategories.map((category) => (
                              <button
                                type="button"
                                className={
                                  selectedCategoryId === category.id
                                    ? 'is-active category-quick-option'
                                    : 'category-quick-option'
                                }
                                aria-pressed={selectedCategoryId === category.id}
                                key={category.id}
                                onClick={() =>
                                  updateCandidateCategory(candidateIndex, category.id)
                                }
                              >
                                <span aria-hidden="true">{category.emoji}</span>
                                <strong>{category.name}</strong>
                              </button>
                            ))}
                          </div>
                          {onCreateCategory === undefined ? null : isCreatingCategory ? (
                            <CategoryCreateForm
                              onCreateCategory={onCreateCategory}
                              onCreated={(category) => {
                                setCustomCategories((currentCategories) =>
                                  currentCategories.some(
                                    (currentCategory) =>
                                      currentCategory.id === category.id,
                                  )
                                    ? currentCategories
                                    : [...currentCategories, category],
                                );
                                setIsCreatingCategory(false);
                                updateCandidateCategory(candidateIndex, category.id);
                              }}
                              onCancel={() => setIsCreatingCategory(false)}
                            />
                          ) : (
                            <button
                              type="button"
                              className="category-create-trigger"
                              onClick={() => setIsCreatingCategory(true)}
                            >
                              + 새 카테고리 추가
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <details className="import-candidate-more">
                    <summary>
                      목적·메모·규칙
                      <small>
                        {budgetBucket?.name ?? candidate.draft.budgetBucketId}
                        {(memoByCandidateIndex.get(candidateIndex) ?? '').trim().length > 0
                          ? ' · 메모 있음'
                          : ''}
                        {categoryRuleCandidateIndexes.has(candidateIndex) ? ' · 규칙 저장' : ''}
                      </small>
                    </summary>
                  <div className="import-candidate-detail-fields">
                    <label>
                      돈의 목적
                      <span className="dashboard-select-control">
                        <select
                          aria-label={`후보 ${candidateIndex + 1} 돈의 목적`}
                          value={
                            budgetBucketIdByCandidateIndex.get(candidateIndex) ??
                            candidate.draft.budgetBucketId
                          }
                          disabled={status === 'SAVING'}
                          onChange={(event) =>
                            updateCandidateBudgetBucket(
                              candidateIndex,
                              event.target.value,
                            )
                          }
                        >
                          {budgetBuckets
                            .filter(
                              (bucket) =>
                                !bucket.isArchived ||
                                bucket.id ===
                                  (budgetBucketIdByCandidateIndex.get(
                                    candidateIndex,
                                  ) ?? candidate.draft.budgetBucketId),
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
                    <label>
                      메모
                      <input
                        type="text"
                        aria-label={`후보 ${candidateIndex + 1} 메모`}
                        value={memoByCandidateIndex.get(candidateIndex) ?? ''}
                        placeholder="예: 친구와 나눈 저녁"
                        maxLength={280}
                        disabled={status === 'SAVING'}
                        onChange={(event) =>
                          updateCandidateMemo(candidateIndex, event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <label className="import-category-rule">
                    <input
                      type="checkbox"
                      aria-label={`후보 ${candidateIndex + 1} 카테고리 규칙 저장`}
                      checked={categoryRuleCandidateIndexes.has(candidateIndex)}
                      disabled={
                        status === 'SAVING' ||
                        !isCandidateSelected ||
                        selectedCategoryId === undefined
                      }
                      onChange={() => toggleCategoryRule(candidateIndex)}
                    />
                    <span>
                      <strong>앞으로 같은 설명에도 적용</strong>
                      <small>선택하면 이 카테고리를 규칙으로 기억해요.</small>
                    </span>
                  </label>
                  </details>
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
  };

  return (
    <div
      className={`legacy-import-preview legacy-import-preview--${status.toLowerCase()}`}
      id="import"
      aria-busy={isBusy}
    >
      {kakaoAnalysisPendingCount > 0 ? (
        <div className="import-kakao-loading" role="status" aria-live="polite">
          <span className="import-kakao-loading-spinner" aria-hidden="true" />
          <span>
            <strong>Kakao 장소를 분석하고 있어요</strong>
            <small>
              {kakaoAnalysisPendingCount}건을 처리 중입니다. 결과가 도착하면 자동으로 표시됩니다.
            </small>
          </span>
        </div>
      ) : null}

      {status === 'IDLE' ? (
        <div className="import-start-state">
          <ImportFileIllustration />
          <h2 id="import-title">소비 내역 파일을 선택해 주세요</h2>
          <p>
            계좌 거래와 카드 이용내역 XLS를 이 기기에서 읽고, 확인할 거래를
            차근차근 정리해요.
          </p>
        </div>
      ) : null}

      {status === 'READING' ? (
        <div className="import-reading-state" role="status" aria-live="polite">
          <span className="import-reading-spinner" aria-hidden="true" />
          <h2>파일을 읽고 있어요</h2>
          <p>거래와 중복 가능성을 이 기기에서 확인하고 있습니다.</p>
        </div>
      ) : null}

      <label
        className={
          isDropActive
            ? 'import-file-action import-file-dropzone is-dragging'
            : 'import-file-action import-file-dropzone'
        }
        data-testid="import-file-dropzone"
        onDragEnter={(event) => {
          event.preventDefault();
          if (status !== 'SAVING') {
            setIsDropActive(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDragLeave={() => setIsDropActive(false)}
        onDrop={handleFileDrop}
      >
        <input
          type="file"
          accept=".xls,application/vnd.ms-excel"
          aria-label="XLS 파일 선택"
          disabled={status === 'SAVING'}
          onChange={handleFileChange}
        />
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        <span>
          {status === 'IDLE' ? '파일 선택하기' : '다른 파일 선택하기'}
          <small>또는 XLS 파일을 여기로 끌어놓기</small>
        </span>
      </label>

      {pickLatestLocalFinanceXls === undefined ? null : (
        <div className="import-folder-import">
          <button
            type="button"
            className="import-folder-action"
            aria-describedby="import-folder-hint"
            disabled={status === 'READING' || status === 'SAVING'}
            onClick={() => void handleLocalFinanceFolderImport()}
          >
            로컬 금융 폴더에서 최신 XLS 불러오기
          </button>
          {/* Chrome은 다운로드 폴더 자체를 폴더 선택 대상에서 막고 하위 폴더만 허용한다. */}
          <p className="import-folder-hint" id="import-folder-hint">
            다운로드 폴더 자체는 선택할 수 없어요. 금융 파일을 모아 둔 하위 폴더를 골라 주세요.
          </p>
          {localFolderMessage === null ? null : (
            <p className="import-folder-message" role="status">
              {localFolderMessage}
            </p>
          )}
        </div>
      )}

      {preview !== null ? (
        <section className="import-preview-result" aria-labelledby="import-result-title">
          <div className="import-preview-heading">
            <span className="import-result-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="m6.5 12.5 3.2 3.2 7.8-8"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />
              </svg>
            </span>
            <div className="import-preview-heading__copy">
              <span className="step-label">파일 확인 완료</span>
              <h4 id="import-result-title">{preview.candidates.length}건을 찾았어요</h4>
              <p>
                {preview.source === undefined
                  ? '지원 여부를 확인할 파일'
                  : SOURCE_LABELS[preview.source]}
              </p>
            </div>
            <button
              type="button"
              className="import-clear-action"
              disabled={status === 'SAVING'}
              onClick={resetPreview}
            >
              지우기
            </button>
          </div>

          <p className="import-preview-announcement" role="status" aria-live="polite">
            {duplicateCheckFailed
              ? `거래 후보 ${preview.candidates.length}건을 읽었지만 신규·중복 여부는 확인하지 못했습니다. 분류 필요 ${classificationNeededCount}건입니다.${excludedIssueNotice}`
              : `새 거래 ${newCandidateCount}건, 중복 가능 ${duplicateCandidateCount}건, 분류 필요 ${classificationNeededCount}건을 찾았습니다.${excludedIssueNotice}`}
          </p>

          {isSaved && saveMessage !== null ? (
            <div
              className="import-saved-notice"
              ref={savedNoticeRef}
              role="status"
              tabIndex={-1}
            >
              <strong>{saveMessage}</strong>
              <p>거래 화면에서 기간별로 확인하고 분류를 이어서 바꿀 수 있어요.</p>
              <div className="import-saved-notice__actions">
                {onViewSavedTransactions === undefined ? null : (
                  <button type="button" onClick={onViewSavedTransactions}>
                    거래 화면에서 보기
                  </button>
                )}
                <button type="button" onClick={resetPreview}>
                  다른 파일 불러오기
                </button>
              </div>
            </div>
          ) : null}

          <dl className="import-preview-stats" aria-label="가져오기 결과 요약">
            <div className="import-preview-stat import-preview-stat--new">
              <dt>새 거래</dt>
              <dd>{newCandidateCount === null ? '확인 보류' : `${newCandidateCount}건`}</dd>
            </div>
            <div className="import-preview-stat import-preview-stat--duplicate">
              <dt>중복 가능</dt>
              <dd>{duplicateCheckFailed ? '확인 실패' : `${duplicateCandidateCount}건`}</dd>
            </div>
            <div className="import-preview-stat import-preview-stat--review">
              <dt>분류 필요</dt>
              <dd>{classificationNeededCount}건</dd>
            </div>
          </dl>

          {duplicateCheckFailed ? (
            <p className="duplicate-check-error" role="alert">
              저장된 거래와 중복 가능성을 비교하지 못했습니다. 파일을 다시 선택한 뒤 확인해 주세요.
            </p>
          ) : null}

          {!isSaved && duplicateCandidateMatches.length > 0 ? (
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
                          disabled={status === 'SAVING'}
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

          {!isSaved && preview.issues.length > 0 ? (
            <div className="import-issue-list" role="alert">
              <strong>자동 반영하지 않은 항목 {preview.issues.length}건</strong>
              <ul>
                {preview.issues.slice(0, MAX_VISIBLE_IMPORT_ISSUES).map((issue, index) => (
                  <li key={`${issue.code}-${issue.rowNumber ?? 'file'}-${index}`}>
                    {getIssueLabel(issue)}
                  </li>
                ))}
              </ul>
              {preview.issues.length > MAX_VISIBLE_IMPORT_ISSUES ? (
                <small>외 {preview.issues.length - MAX_VISIBLE_IMPORT_ISSUES}건</small>
              ) : null}
            </div>
          ) : null}

          {!isSaved && candidateDescriptionGroups.length > 0 ? (
            <section
              className="import-description-groups"
              aria-labelledby="import-description-groups-title"
            >
              <div className="import-review-section-heading">
                <div>
                  <span>한 번에 분류</span>
                  <h5 id="import-description-groups-title">같은 거래 설명 묶음</h5>
                </div>
                <strong>{candidateDescriptionGroups.length}묶음</strong>
              </div>
              <ul aria-label="같은 거래 설명 묶음">
                {candidateDescriptionGroups.map((group) => {
                  const groupCategoryIds = new Set(
                    group.candidateIndexes.map((candidateIndex) =>
                      categoryIdByCandidateIndex.get(candidateIndex),
                    ),
                  );
                  const [firstGroupCategoryId] = groupCategoryIds;
                  const groupCategoryValue =
                    groupCategoryIds.size > 1
                      ? MIXED_CATEGORY_VALUE
                      : (firstGroupCategoryId ?? '');
                  const ruleEligibleIndexes = group.candidateIndexes.filter(
                    (candidateIndex) =>
                      selectedCandidateIndexes.has(candidateIndex) &&
                      categoryIdByCandidateIndex.get(candidateIndex) !== undefined,
                  );
                  const isGroupRuleChecked =
                    ruleEligibleIndexes.length > 0 &&
                    ruleEligibleIndexes.every((candidateIndex) =>
                      categoryRuleCandidateIndexes.has(candidateIndex),
                    );

                  return (
                    <li key={group.key}>
                      <span className="import-description-group__copy">
                        <strong>{group.label}</strong>
                        <small>
                          {group.candidateIndexes.length}건 · 합계{' '}
                          {formatWon(group.totalAmountMinor)}
                        </small>
                      </span>
                      <span className="dashboard-select-control">
                        <select
                          aria-label={`${group.label} ${group.candidateIndexes.length}건 카테고리 한 번에 선택`}
                          value={groupCategoryValue}
                          disabled={status === 'SAVING'}
                          onChange={(event) =>
                            updateGroupCategory(
                              group.candidateIndexes,
                              event.target.value === ''
                                ? undefined
                                : (event.target.value as CategoryId),
                            )
                          }
                        >
                          {groupCategoryValue === MIXED_CATEGORY_VALUE ? (
                            <option value={MIXED_CATEGORY_VALUE} disabled>
                              여러 카테고리
                            </option>
                          ) : null}
                          <option value="">미분류</option>
                          {CATEGORY_IDS.map((categoryId) => (
                            <option key={categoryId} value={categoryId}>
                              {getCategorySymbol(categoryId, customCategories)}{' '}
                              {getCategoryLabel(categoryId, customCategories)}
                            </option>
                          ))}
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
                      <label className="import-category-rule">
                        <input
                          type="checkbox"
                          aria-label={`${group.label} 묶음 카테고리 규칙 저장`}
                          checked={isGroupRuleChecked}
                          disabled={status === 'SAVING' || ruleEligibleIndexes.length === 0}
                          onChange={(event) =>
                            updateGroupCategoryRule(
                              group.candidateIndexes,
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          <strong>앞으로 같은 설명에도 적용</strong>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {!isSaved && preview.candidates.length > 0 ? (
            <>
              <div className="import-review-section-heading">
                <div>
                  <span>거래별 확인</span>
                  <h5>분류가 필요한 거래부터 확인해 주세요</h5>
                </div>
                <strong>{preview.candidates.length}건</strong>
              </div>
              {reviewFirstCandidateCount > 0 ? (
                <ul className="import-candidate-list" aria-label="분류가 필요한 가져오기 후보">
                  {preview.candidates.map((candidate, candidateIndex) =>
                    reviewFirstCandidateIndexes.has(candidateIndex)
                      ? renderCandidate(candidate, candidateIndex)
                      : null,
                  )}
                </ul>
              ) : (
                <p className="import-candidate-all-classified">
                  모든 거래가 자동으로 분류됐어요. 아래에서 추천 결과를 확인할 수 있어요.
                </p>
              )}
              {preview.candidates.length > reviewFirstCandidateCount ? (
                <details className="import-classified-candidates">
                  <summary>
                    자동 분류된 거래 {preview.candidates.length - reviewFirstCandidateCount}건
                    <small>펼쳐서 추천 결과 확인</small>
                  </summary>
                  <ul className="import-candidate-list" aria-label="자동 분류된 가져오기 후보">
                    {preview.candidates.map((candidate, candidateIndex) =>
                      reviewFirstCandidateIndexes.has(candidateIndex)
                        ? null
                        : renderCandidate(candidate, candidateIndex),
                    )}
                  </ul>
                </details>
              ) : null}
            </>
          ) : null}

          {!isSaved && saveMessage !== null ? (
            <p className="import-save-message" role="status">
              {saveMessage}
            </p>
          ) : null}

          {!isSaved && confirmPreview !== undefined && preview.candidates.length > 0 ? (
            <div className="import-confirmation">
              <button
                type="button"
                className="import-confirm-action"
                data-testid="import-confirm-action"
                onClick={handleConfirm}
                aria-describedby={`import-selection-note import-confirmation-note${
                  kakaoAnalysisPendingCount > 0
                    ? ' import-kakao-confirmation-blocker'
                    : ''
                }`}
                disabled={
                  status === 'SAVING' ||
                  duplicateCheckFailed ||
                  kakaoAnalysisPendingCount > 0 ||
                  selectedCandidateCount === 0
                }
              >
                {status === 'SAVING'
                  ? '선택한 거래를 저장하는 중'
                  : kakaoAnalysisPendingCount > 0
                    ? 'Kakao 분석을 기다리는 중'
                    : `${selectedCandidateCount}건 저장하기`}
              </button>
              {kakaoAnalysisPendingCount > 0 ? (
                <p
                  className="import-selection-note"
                  id="import-kakao-confirmation-blocker"
                  role="status"
                >
                  Kakao 장소 분석 {kakaoAnalysisPendingCount}건이 끝나면 저장할 수
                  있어요.
                </p>
              ) : null}
              <p className="import-selection-note" id="import-selection-note">
                {selectedCandidateCount}건을 저장할 예정이에요. 중복 가능 거래는 직접
                포함해야 저장돼요.
              </p>
              <p className="import-confirmation-note" id="import-confirmation-note">
                저장 후 거래 화면에서 기간별로 확인할 수 있어요.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
