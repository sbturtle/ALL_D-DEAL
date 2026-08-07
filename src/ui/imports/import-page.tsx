import type { LegacyXlsImportConfirmationOptions, LegacyXlsImportConfirmationResult } from '../../application/imports/confirm-legacy-xls-import';
import type { LegacyXlsPreviewReader } from '../../application/imports/prepare-legacy-xls-import';
import type { DuplicateCandidateMatch } from '../../domain/imports/duplicate-candidates';
import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import type { PlaceSearch } from '../../application/places/place-search';

import { LegacyXlsImportPreview } from './legacy-xls-import-preview';

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
}>;

export function ImportPage({
  previewLegacyXls,
  confirmLegacyXlsImport,
  findPotentialLegacyXlsImportDuplicates,
  applyCategoryRulesToLegacyXlsPreview,
  searchPlaces,
}: ImportPageProps) {
  return (
    <section className="import-page" aria-labelledby="import-page-title">
      <div className="import-page-intro">
        <p className="eyebrow">WEEKLY IMPORT</p>
        <h1 id="import-page-title">
          이번 주 거래,
          <br />
          <em>확인하고 장부에 넣기.</em>
        </h1>
        <p>
          파일은 브라우저 안에서 거래 후보로 정리합니다. Kakao 설정 시 지출 후보의
          상호명 검색어만 Kakao Local API로 전송합니다. 카테고리와 중복 가능성을
          확인한 뒤 선택한 거래만 저장하세요.
        </p>
        <ul aria-label="XLS 가져오기 원칙">
          <li>원본 파일과 파일명은 저장하지 않음</li>
          <li>중복 가능 거래는 저장 전 직접 확인</li>
          <li>카테고리 규칙은 원할 때만 기억</li>
          <li>Kakao 설정 시 상호명 검색어만 전송하며 분석 결과는 저장하지 않음</li>
        </ul>
      </div>

      <div className="import-card import-card--active import-page-card">
        <LegacyXlsImportPreview
          previewFile={previewLegacyXls}
          applyCategoryRules={applyCategoryRulesToLegacyXlsPreview}
          confirmPreview={confirmLegacyXlsImport}
          findPotentialDuplicates={findPotentialLegacyXlsImportDuplicates}
          searchPlaces={searchPlaces}
        />
      </div>
    </section>
  );
}
