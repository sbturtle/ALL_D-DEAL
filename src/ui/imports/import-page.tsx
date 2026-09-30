import { useEffect, useState } from 'react';

import type { LegacyXlsImportConfirmationOptions, LegacyXlsImportConfirmationResult } from '../../application/imports/confirm-legacy-xls-import';
import type { LatestLocalFinanceXlsPicker } from '../../application/imports/local-finance-directory-import';
import type { LegacyXlsPreviewReader } from '../../application/imports/prepare-legacy-xls-import';
import type { DuplicateCandidateMatch } from '../../domain/imports/duplicate-candidates';
import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import type { PlaceSearch } from '../../application/places/place-search';
import {
  DEFAULT_BUDGET_BUCKETS,
  type BudgetBucket,
} from '../../domain/budget-buckets/budget-bucket';
import type { CustomCategory } from '../../domain/categories/custom-category';

import { LegacyXlsImportPreview } from './legacy-xls-import-preview';
import './import-page-refresh.css';

type ImportPageProps = Readonly<{
  previewLegacyXls: LegacyXlsPreviewReader;
  confirmLegacyXlsImport: (
    preview: ImportPreview,
    options?: LegacyXlsImportConfirmationOptions,
  ) => Promise<LegacyXlsImportConfirmationResult>;
  findPotentialLegacyXlsImportDuplicates: (
    preview: ImportPreview,
  ) => Promise<readonly DuplicateCandidateMatch[]>;
  applyCategoryRulesToLegacyXlsPreview: (
    preview: ImportPreview,
  ) => Promise<ImportPreview>;
  searchPlaces?: PlaceSearch;
  listBudgetBuckets?: () => Promise<readonly BudgetBucket[]>;
  listCustomCategories?: () => Promise<readonly CustomCategory[]>;
  onCreateCategory?: (
    name: string,
    emoji: string,
  ) => Promise<CustomCategory | undefined>;
  onViewSavedTransactions?: () => void;
  pickLatestLocalFinanceXls?: LatestLocalFinanceXlsPicker;
}>;

export function ImportPage({
  previewLegacyXls,
  confirmLegacyXlsImport,
  findPotentialLegacyXlsImportDuplicates,
  applyCategoryRulesToLegacyXlsPreview,
  searchPlaces,
  listBudgetBuckets,
  listCustomCategories,
  onCreateCategory,
  onViewSavedTransactions,
  pickLatestLocalFinanceXls,
}: ImportPageProps) {
  const [budgetBuckets, setBudgetBuckets] = useState<readonly BudgetBucket[]>(
    DEFAULT_BUDGET_BUCKETS,
  );
  const [customCategories, setCustomCategories] = useState<
    readonly CustomCategory[]
  >([]);

  useEffect(() => {
    if (listBudgetBuckets === undefined) {
      return undefined;
    }

    let isCurrent = true;
    void listBudgetBuckets()
      .then((nextBudgetBuckets) => {
        if (isCurrent && nextBudgetBuckets.length > 0) {
          setBudgetBuckets(nextBudgetBuckets);
        }
      })
      .catch(() => {
        // The preview remains usable with the built-in purpose list.
      });

    return () => {
      isCurrent = false;
    };
  }, [listBudgetBuckets]);

  useEffect(() => {
    if (listCustomCategories === undefined) {
      return undefined;
    }

    let isCurrent = true;
    void listCustomCategories()
      .then((nextCustomCategories) => {
        if (isCurrent) {
          setCustomCategories(nextCustomCategories);
        }
      })
      .catch(() => {
        // The built-in categories remain available when the local store is unavailable.
      });

    return () => {
      isCurrent = false;
    };
  }, [listCustomCategories]);

  const handleCreateCategory = async (name: string, emoji: string) => {
    if (onCreateCategory === undefined) {
      return undefined;
    }

    const category = await onCreateCategory(name, emoji);
    if (category !== undefined) {
      setCustomCategories((currentCategories) => [
        ...currentCategories,
        category,
      ]);
    }
    return category;
  };

  return (
    <section className="import-page" aria-labelledby="import-page-title">
      <header className="import-page-intro">
        <p className="eyebrow">주간 소비 정리</p>
        <h1 id="import-page-title">이번 주 소비 불러오기</h1>
        <p>
          계좌 거래나 카드 이용내역 파일을 고르면, 저장하기 전에 확인하기 쉽게
          정리해 드릴게요.
        </p>
      </header>

      <p className="import-external-boundary" role="note">
        <strong>Kakao를 설정한 경우</strong>
        미분류 지출의 상호명 검색어만 전송하며, 원본 파일과 분석 결과는 외부에
        저장하지 않아요.
      </p>

      <div className="import-card import-card--active import-page-card">
        <LegacyXlsImportPreview
          previewFile={previewLegacyXls}
          applyCategoryRules={applyCategoryRulesToLegacyXlsPreview}
          confirmPreview={confirmLegacyXlsImport}
          findPotentialDuplicates={findPotentialLegacyXlsImportDuplicates}
          searchPlaces={searchPlaces}
          budgetBuckets={budgetBuckets}
          customCategories={customCategories}
          onCreateCategory={
            onCreateCategory === undefined ? undefined : handleCreateCategory
          }
          onViewSavedTransactions={onViewSavedTransactions}
          pickLatestLocalFinanceXls={pickLatestLocalFinanceXls}
        />
      </div>

      <details className="import-privacy-details">
        <summary>파일과 거래 정보는 어떻게 처리하나요?</summary>
        <ul aria-label="XLS 가져오기 원칙">
          <li>원본 파일과 파일명은 저장하지 않아요.</li>
          <li>중복 가능 거래는 저장 전에 직접 선택해요.</li>
          <li>카테고리 규칙은 동의한 거래만 다음에도 기억해요.</li>
          <li>
            Kakao 설정 시 지출 상호명 검색어만 전송하고, 분석 결과는 저장하지
            않아요.
          </li>
        </ul>
      </details>
    </section>
  );
}
