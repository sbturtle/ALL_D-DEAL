import { useEffect, useState, type MouseEvent } from 'react';

import { applyCategoryRulesToLegacyXlsPreview } from '../application/imports/apply-category-rules-to-legacy-xls-preview';
import {
  confirmLegacyXlsImport,
  type LegacyXlsImportConfirmationOptions,
  type LegacyXlsImportConfirmationResult,
} from '../application/imports/confirm-legacy-xls-import';
import { findPotentialLegacyXlsImportDuplicates } from '../application/imports/find-legacy-xls-import-duplicates';
import {
  prepareLegacyXlsImportPreview,
  type LegacyXlsImportFile,
} from '../application/imports/prepare-legacy-xls-import';
import type { ImportPreview } from '../domain/imports/legacy-xls-preview';
import type { UtcIsoInstant } from '../domain/transactions/utc-iso-instant';
import { previewLegacyXlsFile } from '../infrastructure/imports/legacy-xls-file-reader';
import { BrowserLedgerRepository } from '../infrastructure/storage/browser-ledger-repository';
import { getKakaoMapPlaceSearch } from '../infrastructure/kakao/kakao-map-config';
import { DashboardSection } from '../ui/dashboard/dashboard-section';
import { ImportPage } from '../ui/imports/import-page';
import { PayrollPage } from '../ui/payroll-estimate/payroll-page';

import { getAppRoute, getAppRoutePath, type AppRoute } from './app-route';
import './app.css';

const NAVIGATION_ITEMS: readonly Readonly<{
  route: AppRoute;
  label: string;
}>[] = [
  { route: 'LEDGER', label: '장부' },
  { route: 'IMPORTS', label: 'XLS 가져오기' },
  { route: 'PAYROLL', label: '급여 계산' },
];

const ledgerRepository = new BrowserLedgerRepository();
const kakaoMapPlaceSearch = getKakaoMapPlaceSearch();

function previewSelectedLegacyXls(file: LegacyXlsImportFile) {
  return prepareLegacyXlsImportPreview(file, previewLegacyXlsFile);
}

function createLocalId(): string {
  return crypto.randomUUID();
}

function currentUtcIsoInstant(): UtcIsoInstant {
  return new Date().toISOString() as UtcIsoInstant;
}

function confirmSelectedLegacyXlsImport(
  preview: ImportPreview,
  options?: LegacyXlsImportConfirmationOptions,
): Promise<LegacyXlsImportConfirmationResult> {
  return confirmLegacyXlsImport(
    preview,
    {
      committer: ledgerRepository,
      createId: createLocalId,
      now: currentUtcIsoInstant,
    },
    options,
  );
}

function findSelectedLegacyXlsImportDuplicates(preview: ImportPreview) {
  return findPotentialLegacyXlsImportDuplicates(preview, ledgerRepository);
}

function applySelectedCategoryRules(preview: ImportPreview) {
  return applyCategoryRulesToLegacyXlsPreview(preview, ledgerRepository);
}

function isModifiedNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  );
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    getAppRoute(window.location.pathname),
  );

  useEffect(() => {
    const handlePopState = () => setRoute(getAppRoute(window.location.pathname));

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    nextRoute: AppRoute,
  ) => {
    if (isModifiedNavigation(event)) {
      return;
    }

    event.preventDefault();
    const nextPath = getAppRoutePath(nextRoute);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    setRoute(nextRoute);
  };

  return (
    <div className="app-shell" id="top">
      <header className="site-header">
        <a
          className="brand"
          href={getAppRoutePath('LEDGER')}
          aria-label="가계부 장부로"
          onClick={(event) => handleNavigation(event, 'LEDGER')}
        >
          <span aria-hidden="true">ㄱ</span>
          <strong>가계부</strong>
        </a>

        <nav aria-label="주요 메뉴">
          {NAVIGATION_ITEMS.map((item) => (
            <a
              href={getAppRoutePath(item.route)}
              aria-current={route === item.route ? 'page' : undefined}
              key={item.route}
              onClick={(event) => handleNavigation(event, item.route)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <span className="phase-chip">PHASE 6A · LOCAL</span>
      </header>

      <main className={`work-page work-page--${route.toLowerCase()}`}>
        {route === 'PAYROLL' ? <PayrollPage /> : null}
        {route === 'LEDGER' ? <DashboardSection ledgerRepository={ledgerRepository} /> : null}
        {route === 'IMPORTS' ? (
          <ImportPage
            previewLegacyXls={previewSelectedLegacyXls}
            confirmLegacyXlsImport={confirmSelectedLegacyXlsImport}
            findPotentialLegacyXlsImportDuplicates={findSelectedLegacyXlsImportDuplicates}
              applyCategoryRulesToLegacyXlsPreview={applySelectedCategoryRules}
              searchPlaces={kakaoMapPlaceSearch}
          />
        ) : null}
      </main>

      <footer>
        <a
          className="brand brand--footer"
          href={getAppRoutePath('LEDGER')}
          onClick={(event) => handleNavigation(event, 'LEDGER')}
        >
          <span aria-hidden="true">ㄱ</span>
          <strong>가계부</strong>
        </a>
        <p>개인 자산을 내 손으로 이해하는 local-first 프로젝트</p>
        <a
          href={getAppRoutePath('IMPORTS')}
          onClick={(event) => handleNavigation(event, 'IMPORTS')}
        >
          XLS 가져오기 →
        </a>
      </footer>
    </div>
  );
}
