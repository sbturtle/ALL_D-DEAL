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
import { SettingsPage } from '../ui/settings/settings-page';
import { MobileAppShell } from '../ui/shell/mobile-app-shell';

import {
  APP_ROUTE_TITLES,
  getAppRoute,
  getAppRoutePath,
  type AppRoute,
} from './app-route';
import './app.css';
import './mobile-app.css';

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

  useEffect(() => {
    document.title = `${APP_ROUTE_TITLES[route]} · 내 가계부`;
  }, [route]);

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
    <MobileAppShell currentRoute={route} onNavigate={handleNavigation}>
      <div className={`work-page work-page--${route.toLowerCase()}`}>
        {route === 'HOME' ? (
          <DashboardSection page="HOME" ledgerRepository={ledgerRepository} />
        ) : null}
        {route === 'TRANSACTIONS' ? (
          <DashboardSection
            page="TRANSACTIONS"
            ledgerRepository={ledgerRepository}
          />
        ) : null}
        {route === 'PAYROLL' ? <PayrollPage /> : null}
        {route === 'IMPORTS' ? (
          <ImportPage
            previewLegacyXls={previewSelectedLegacyXls}
            confirmLegacyXlsImport={confirmSelectedLegacyXlsImport}
            findPotentialLegacyXlsImportDuplicates={findSelectedLegacyXlsImportDuplicates}
            applyCategoryRulesToLegacyXlsPreview={applySelectedCategoryRules}
            searchPlaces={kakaoMapPlaceSearch}
          />
        ) : null}
        {route === 'SETTINGS' ? (
          <SettingsPage settingsRepository={ledgerRepository} />
        ) : null}
      </div>
    </MobileAppShell>
  );
}
