import { useState, type ChangeEvent } from 'react';

import {
  exportLocalLedger,
  parseLocalLedgerBackup,
  restoreLocalLedger,
  serializeLocalLedgerBackup,
  type LocalLedgerBackupParseResult,
  type LocalLedgerBackupRepository,
} from '../../application/settings/manage-local-ledger-backup';
import type { LocalLedgerBackup } from '../../domain/ledger-backup/local-ledger-backup';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';

type ValidBackup = Extract<LocalLedgerBackupParseResult, { isValid: true }>;

type LocalLedgerBackupCardProps = Readonly<{
  repository: LocalLedgerBackupRepository;
  onRestored: (backup: LocalLedgerBackup) => void;
}>;

type BackupNotice = Readonly<{
  tone: 'success' | 'error';
  message: string;
}>;

function currentUtcIsoInstant(): UtcIsoInstant {
  return new Date().toISOString() as UtcIsoInstant;
}

export function LocalLedgerBackupCard({
  repository,
  onRestored,
}: LocalLedgerBackupCardProps) {
  const [pendingRestore, setPendingRestore] = useState<ValidBackup>();
  const [notice, setNotice] = useState<BackupNotice>();
  const [isExporting, setIsExporting] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const isBusy = isExporting || isReading || isRestoring;

  const handleExport = async () => {
    setIsExporting(true);
    setNotice(undefined);
    try {
      const exportedAt = currentUtcIsoInstant();
      const backup = await exportLocalLedger(repository, exportedAt);
      const blob = new Blob([serializeLocalLedgerBackup(backup)], {
        type: 'application/json',
      });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `all-d-deal-backup-${exportedAt.slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setNotice({
        tone: 'success',
        message: '이 브라우저의 장부를 JSON 파일로 내보냈어요.',
      });
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      setNotice({
        tone: 'error',
        message: '장부 백업 파일을 만들지 못했어요. 다시 시도해 주세요.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.item(0);
    if (file === undefined || file === null) {
      return;
    }

    setIsReading(true);
    setPendingRestore(undefined);
    setNotice(undefined);
    try {
      const result = parseLocalLedgerBackup(await file.text());
      if (!result.isValid) {
        setNotice({
          tone: 'error',
          message: '올바른 ALL D·DEAL 백업 JSON 파일을 선택해 주세요.',
        });
        return;
      }
      setPendingRestore(result);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      setNotice({
        tone: 'error',
        message: '백업 파일을 읽지 못했어요. 파일을 확인한 뒤 다시 시도해 주세요.',
      });
    } finally {
      input.value = '';
      setIsReading(false);
    }
  };

  const handleRestore = async () => {
    if (pendingRestore === undefined) {
      return;
    }

    setIsRestoring(true);
    setNotice(undefined);
    try {
      const result = await restoreLocalLedger(
        pendingRestore.backup,
        repository,
      );
      if (!result.isRestored) {
        setNotice({
          tone: 'error',
          message: '장부를 복원하지 못했어요. 현재 장부는 그대로 유지됩니다.',
        });
        return;
      }
      onRestored(pendingRestore.backup);
      setPendingRestore(undefined);
      setNotice({
        tone: 'success',
        message: '백업한 장부를 이 브라우저에 복원했어요.',
      });
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      setNotice({
        tone: 'error',
        message: '장부를 복원하지 못했어요. 현재 장부는 그대로 유지됩니다.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <article className="settings-backup-card" aria-labelledby="backup-card-title">
      <div className="settings-backup-card__heading">
        <p className="panel-kicker">로컬 데이터 관리</p>
        <h2 id="backup-card-title">장부 백업·복원</h2>
        <p>
          거래와 분류 규칙, 돈의 목적, 설정을 JSON 파일로 보관하거나 복원해요.
          원본 금융 파일과 가져오기 미리보기는 포함하지 않아요.
        </p>
        <p className="settings-backup-card__privacy">
          파일을 만들고 읽는 작업은 이 브라우저에서만 처리해요.
        </p>
      </div>

      <div className="settings-backup-card__actions">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleExport()}
        >
          {isExporting ? '백업 파일 만드는 중' : '장부 백업 파일 내보내기'}
        </button>
        <label className="settings-backup-file-picker">
          <span>{isReading ? '백업 파일 읽는 중' : '백업 JSON 파일 선택'}</span>
          <input
            type="file"
            accept=".json,application/json"
            aria-label="복원할 장부 백업 JSON 파일"
            disabled={isBusy}
            onChange={(event) => void handleFileChange(event)}
          />
        </label>
      </div>

      {pendingRestore === undefined ? null : (
        <section
          className="settings-backup-confirmation"
          aria-labelledby="backup-confirmation-title"
        >
          <div>
            <h3 id="backup-confirmation-title">복원할 장부 내용</h3>
            <p>확인을 누르면 현재 장부를 이 백업 내용으로 교체합니다.</p>
          </div>
          <dl>
            <div><dt>거래</dt><dd>{pendingRestore.summary.transactionCount}건</dd></div>
            <div><dt>가져오기 기록</dt><dd>{pendingRestore.summary.importBatchCount}건</dd></div>
            <div><dt>공동결제 정산</dt><dd>{pendingRestore.summary.settlementCount}건</dd></div>
            <div><dt>정확한 이름 규칙</dt><dd>{pendingRestore.summary.categoryRuleCount}개</dd></div>
            <div><dt>포함 키워드 규칙</dt><dd>{pendingRestore.summary.keywordCategoryRuleCount}개</dd></div>
            <div><dt>월 생활비 목표</dt><dd>{pendingRestore.summary.hasUserSettings ? '있음' : '없음'}</dd></div>
            <div><dt>돈의 목적</dt><dd>{pendingRestore.summary.budgetBucketCount}개</dd></div>
            <div><dt>사용자 카테고리</dt><dd>{pendingRestore.summary.customCategoryCount}개</dd></div>
            <div><dt>거래 이미지</dt><dd>{pendingRestore.summary.attachmentCount}개</dd></div>
          </dl>
          <div className="settings-backup-confirmation__actions">
            <button
              type="button"
              disabled={isRestoring}
              onClick={() => setPendingRestore(undefined)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleRestore()}
            >
              {isRestoring ? '복원 중' : '이 백업으로 장부 교체'}
            </button>
          </div>
        </section>
      )}

      {notice === undefined ? null : (
        <p
          className={`settings-notice settings-notice--${notice.tone}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          {notice.message}
        </p>
      )}
    </article>
  );
}
