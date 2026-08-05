import { useRef, useState } from 'react';

import type {
  ImportIssue,
  ImportPreview,
  ImportSource,
} from '../../domain/imports/legacy-xls-preview';
import type { LegacyXlsPreviewReader } from '../../application/imports/prepare-legacy-xls-import';
import type { TransactionType } from '../../domain/transactions/transaction';
import { formatWon } from '../../shared/format/currency';

type ImportStatus = 'IDLE' | 'READING' | 'PREVIEW';

export type LegacyXlsImportPreviewProps = Readonly<{
  previewFile: LegacyXlsPreviewReader;
}>;

const SOURCE_LABELS: Readonly<Record<ImportSource, string>> = {
  ACCOUNT_LEDGER_XLS: '계좌 거래 XLS',
  CARD_USAGE_XLS: '카드 이용 XLS',
};

function getCandidateTypeLabel(type: TransactionType): string {
  return type === 'EXPENSE' ? '지출 후보' : '유형 확인 필요';
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

export function LegacyXlsImportPreview({ previewFile }: LegacyXlsImportPreviewProps) {
  const [status, setStatus] = useState<ImportStatus>('IDLE');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const requestIdRef = useRef(0);

  const resetPreview = () => {
    requestIdRef.current += 1;
    setStatus('IDLE');
    setPreview(null);
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

    try {
      const nextPreview = await previewFile(file);

      if (requestId === requestIdRef.current) {
        setPreview(nextPreview);
        setStatus('PREVIEW');
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

  return (
    <div className="legacy-import-preview" id="import">
      <span className="status-pill">사용 가능 · Preview</span>
      <p className="panel-kicker">LOCAL XLS IMPORT</p>
      <h3 id="import-title">내 XLS 파일 미리보기</h3>
      <p>
        계좌 거래와 카드 이용내역을 브라우저 안에서 읽습니다. 이번 단계에서는
        저장하지 않습니다.
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

          {preview.candidates.length > 0 ? (
            <ul className="import-candidate-list" aria-label="가져오기 후보">
              {preview.candidates.slice(0, 6).map((candidate) => (
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
                  <span className="import-candidate-amount">
                    {candidate.draft.direction === 'INFLOW' ? '+' : '−'}
                    {formatWon(candidate.draft.amountMinor)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {preview.candidates.length > 6 ? (
            <p className="import-overflow-note">
              후보 {preview.candidates.length - 6}건은 다음 저장 전 확인 단계에서 계속
              보여드립니다.
            </p>
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

          <small>
            원본 파일과 파일명은 저장하지 않으며, 저장 기능은 다음 단계에서 추가합니다.
          </small>
        </section>
      ) : null}
    </div>
  );
}
