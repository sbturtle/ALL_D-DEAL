import {
  prepareLegacyXlsImportPreview,
  type LegacyXlsImportFile,
} from '../application/imports/prepare-legacy-xls-import';
import {
  confirmLegacyXlsImport,
  type LegacyXlsImportConfirmationResult,
} from '../application/imports/confirm-legacy-xls-import';
import type { ImportPreview } from '../domain/imports/legacy-xls-preview';
import type { UtcIsoInstant } from '../domain/transactions/utc-iso-instant';
import { previewLegacyXlsFile } from '../infrastructure/imports/legacy-xls-file-reader';
import { BrowserLedgerRepository } from '../infrastructure/storage/browser-ledger-repository';
import { DashboardSection } from '../ui/dashboard/dashboard-section';
import { PayrollEstimateCalculator } from '../ui/payroll-estimate/payroll-estimate-calculator';
import './app.css';

function previewSelectedLegacyXls(file: LegacyXlsImportFile) {
  return prepareLegacyXlsImportPreview(file, previewLegacyXlsFile);
}

const ledgerRepository = new BrowserLedgerRepository();

function createLocalId(): string {
  return crypto.randomUUID();
}

function currentUtcIsoInstant(): UtcIsoInstant {
  return new Date().toISOString() as UtcIsoInstant;
}

function confirmSelectedLegacyXlsImport(
  preview: ImportPreview,
): Promise<LegacyXlsImportConfirmationResult> {
  return confirmLegacyXlsImport(preview, {
    committer: ledgerRepository,
    createId: createLocalId,
    now: currentUtcIsoInstant,
  });
}

export function App() {
  return (
    <div className="app-shell" id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="가계부 홈으로">
          <span aria-hidden="true">ㄱ</span>
          <strong>가계부</strong>
        </a>

        <nav aria-label="주요 메뉴">
          <a href="#calculator">급여 계산</a>
          <a href="#ledger">장부 미리보기</a>
          <a href="#import">XLS 가져오기</a>
        </nav>

        <span className="phase-chip">PHASE 3B · LOCAL</span>
      </header>

      <main>
        <section className="hero-section" aria-labelledby="page-title">
          <div className="hero-intro">
            <p className="eyebrow">PAYCHECK, DECODED</p>
            <h1 id="page-title">
              이번 연봉,
              <br />
              <em>실제로 남는 돈은?</em>
            </h1>
            <p className="hero-description">
              월급과 상여를 함께 넣으면 2026년 기준 예상 실수령액과 공제 내역을
              한눈에 풀어드립니다.
            </p>

            <div className="trust-list" aria-label="계산기 특징">
              <span>
                <i aria-hidden="true">01</i>
                외부 전송 없음
              </span>
              <span>
                <i aria-hidden="true">02</i>
                공식 세액표 반영
              </span>
              <span>
                <i aria-hidden="true">03</i>
                상여 월평균 포함
              </span>
            </div>

            <p className="hero-footnote">
              정확한 급여명세서가 아닌 일반 직장근로자용 간편 추정입니다.
            </p>
          </div>

          <PayrollEstimateCalculator />
        </section>

        <DashboardSection
          previewLegacyXls={previewSelectedLegacyXls}
          confirmLegacyXlsImport={confirmSelectedLegacyXlsImport}
          ledgerRepository={ledgerRepository}
        />

        <section className="local-manifesto" aria-labelledby="local-title">
          <div>
            <p className="eyebrow">YOUR DATA, YOUR DEVICE</p>
            <h2 id="local-title">계산도, 앞으로의 장부도 로컬에서.</h2>
          </div>
          <p>
            입력한 급여는 저장하지 않습니다. 금융 XLS는 브라우저 안에서 검토한 뒤,
            사용자가 확인한 거래만 이 기기 장부에 저장합니다.
          </p>
          <span aria-hidden="true">↘</span>
        </section>
      </main>

      <footer>
        <a className="brand brand--footer" href="#top">
          <span aria-hidden="true">ㄱ</span>
          <strong>가계부</strong>
        </a>
        <p>개인 자산을 내 손으로 이해하는 local-first 프로젝트</p>
        <a href="#top">맨 위로 ↑</a>
      </footer>
    </div>
  );
}
