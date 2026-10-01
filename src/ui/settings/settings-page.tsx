import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  addCustomBudgetBucket,
  archiveBudgetBucket,
  editBudgetBucketPresentation,
} from '../../application/settings/manage-budget-buckets';
import {
  clearMonthlyLivingExpenseGoal,
  saveMonthlyLivingExpenseGoal,
} from '../../application/settings/manage-monthly-living-expense-goal';
import type { LocalLedgerBackup } from '../../domain/ledger-backup/local-ledger-backup';
import type { BudgetBucket } from '../../domain/budget-buckets/budget-bucket';
import type { LocalUserSettings } from '../../domain/settings/local-user-settings';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';
import type { BrowserLedgerRepository } from '../../infrastructure/storage/browser-ledger-repository';
import {
  formatWonInput,
  parseWonInput,
  sanitizeWonInput,
} from '../../shared/format/currency';
import { LocalLedgerBackupCard } from './local-ledger-backup-card';
import './settings-page-refresh.css';

export type LocalSettingsRepository = Pick<
  BrowserLedgerRepository,
  | 'getLocalUserSettings'
  | 'saveLocalUserSettings'
  | 'removeLocalUserSettings'
  | 'listBudgetBuckets'
  | 'saveBudgetBucket'
  | 'getLocalLedgerSnapshot'
  | 'replaceLocalLedger'
  | 'resetLocalLedger'
>;

type SettingsPageProps = Readonly<{
  settingsRepository: LocalSettingsRepository;
}>;

type SettingsNotice = Readonly<{
  tone: 'success' | 'error';
  message: string;
}>;

function currentUtcIsoInstant(): UtcIsoInstant {
  return new Date().toISOString() as UtcIsoInstant;
}

export function SettingsPage({
  settingsRepository,
}: SettingsPageProps) {
  const [settings, setSettings] = useState<LocalUserSettings | undefined>(
    undefined,
  );
  const [goalInput, setGoalInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [notice, setNotice] = useState<SettingsNotice | undefined>(undefined);
  const [budgetBuckets, setBudgetBuckets] = useState<readonly BudgetBucket[]>([]);
  const [isBucketLoading, setIsBucketLoading] = useState(true);
  const [isBucketSaving, setIsBucketSaving] = useState(false);
  const [bucketLoadError, setBucketLoadError] = useState(false);
  const [bucketReloadVersion, setBucketReloadVersion] = useState(0);
  const [bucketNotice, setBucketNotice] = useState<SettingsNotice>();
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketIcon, setNewBucketIcon] = useState('');
  const [editingBucketId, setEditingBucketId] = useState<string>();
  const [editingBucketName, setEditingBucketName] = useState('');
  const [editingBucketIcon, setEditingBucketIcon] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string>();
  const [resetNotice, setResetNotice] = useState<string>();
  const resetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resetDialogRef = useRef<HTMLDivElement | null>(null);
  const isResettingRef = useRef(false);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setLoadError(false);

    void settingsRepository
      .getLocalUserSettings()
      .then((nextSettings) => {
        if (!isCurrent) {
          return;
        }

        setSettings(nextSettings);
        setGoalInput(
          nextSettings === undefined
            ? ''
            : String(nextSettings.monthlyLivingExpenseGoalMinor),
        );
      })
      .catch(() => {
        if (isCurrent) {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [reloadVersion, settingsRepository]);

  useEffect(() => {
    let isCurrent = true;
    setIsBucketLoading(true);
    setBucketLoadError(false);

    void settingsRepository
      .listBudgetBuckets()
      .then((buckets) => {
        if (isCurrent) {
          setBudgetBuckets(buckets);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setBucketLoadError(true);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsBucketLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [bucketReloadVersion, settingsRepository]);

  useEffect(() => {
    isResettingRef.current = isResetting;
  }, [isResetting]);

  useEffect(() => {
    if (!isResetDialogOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const resetTrigger = resetTriggerRef.current;
    document.body.style.overflow = 'hidden';

    const firstFocusable = resetDialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled])',
    );
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isResettingRef.current) {
          setIsResetDialogOpen(false);
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = Array.from(
        resetDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled])',
        ) ?? [],
      );
      if (focusableElements.length === 0) {
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      resetTrigger?.focus();
    };
  }, [isResetDialogOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice(undefined);
    const result = await saveMonthlyLivingExpenseGoal(
      {
        monthlyLivingExpenseGoalMinor: parseWonInput(goalInput),
        updatedAt: currentUtcIsoInstant(),
      },
      settingsRepository,
    );
    setIsSaving(false);

    if (!result.isSaved) {
      setNotice({
        tone: 'error',
        message:
          result.code === 'invalid_goal'
            ? '월 생활비 목표는 0보다 큰 원 단위 정수로 입력해 주세요.'
            : '월 생활비 목표를 저장하지 못했습니다. 기존 설정은 변경되지 않았습니다.',
      });
      return;
    }

    setSettings(result.settings);
    setGoalInput(String(result.settings.monthlyLivingExpenseGoalMinor));
    setNotice({
      tone: 'success',
      message: '월 생활비 목표를 이 기기에 저장했어요.',
    });
  };

  const handleClear = async () => {
    if (settings === undefined) {
      setGoalInput('');
      setNotice(undefined);
      return;
    }

    setIsSaving(true);
    setNotice(undefined);
    const result = await clearMonthlyLivingExpenseGoal(settingsRepository);
    setIsSaving(false);

    if (!result.isCleared) {
      setNotice({
        tone: 'error',
        message: '월 생활비 목표를 비우지 못했습니다. 기존 설정은 유지됩니다.',
      });
      return;
    }

    setSettings(undefined);
    setGoalInput('');
    setNotice({
      tone: 'success',
      message: '월 생활비 목표를 이 기기에서 비웠어요.',
    });
  };

  const handleAddBucket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBucketSaving(true);
    setBucketNotice(undefined);
    const result = await addCustomBudgetBucket(
      {
        id: `custom-${crypto.randomUUID()}`,
        name: newBucketName,
        icon: newBucketIcon,
      },
      settingsRepository,
    );
    setIsBucketSaving(false);

    if (!result.isSaved) {
      setBucketNotice({
        tone: 'error',
        message:
          result.code === 'invalid_bucket'
            ? '이름과 아이콘을 모두 입력해 주세요.'
            : '돈의 목적을 저장하지 못했어요. 기존 목록은 유지됩니다.',
      });
      return;
    }

    setBudgetBuckets((current) => [...current, result.bucket]);
    setNewBucketName('');
    setNewBucketIcon('');
    setBucketNotice({ tone: 'success', message: '새 돈의 목적을 추가했어요.' });
  };

  const startEditingBucket = (bucket: BudgetBucket) => {
    setEditingBucketId(bucket.id);
    setEditingBucketName(bucket.name);
    setEditingBucketIcon(bucket.icon);
    setBucketNotice(undefined);
  };

  const handleEditBucket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingBucketId === undefined) {
      return;
    }

    setIsBucketSaving(true);
    setBucketNotice(undefined);
    const result = await editBudgetBucketPresentation(
      {
        id: editingBucketId,
        name: editingBucketName,
        icon: editingBucketIcon,
      },
      settingsRepository,
    );
    setIsBucketSaving(false);

    if (!result.isSaved) {
      setBucketNotice({
        tone: 'error',
        message:
          result.code === 'invalid_bucket'
            ? '이름과 아이콘을 모두 입력해 주세요.'
            : '돈의 목적을 바꾸지 못했어요. 기존 내용은 유지됩니다.',
      });
      return;
    }

    setBudgetBuckets((current) =>
      current.map((bucket) =>
        bucket.id === result.bucket.id ? result.bucket : bucket,
      ),
    );
    setEditingBucketId(undefined);
    setBucketNotice({ tone: 'success', message: '돈의 목적을 바꿨어요.' });
  };

  const handleArchiveBucket = async (bucket: BudgetBucket) => {
    setIsBucketSaving(true);
    setBucketNotice(undefined);
    const result = await archiveBudgetBucket(bucket.id, settingsRepository);
    setIsBucketSaving(false);

    if (!result.isSaved) {
      setBucketNotice({
        tone: 'error',
        message:
          result.code === 'default_bucket'
            ? '기본 목적은 보관할 수 없어요.'
            : '돈의 목적을 보관하지 못했어요. 기존 목록은 유지됩니다.',
      });
      return;
    }

    setBudgetBuckets((current) =>
      current.map((candidate) =>
        candidate.id === result.bucket.id ? result.bucket : candidate,
      ),
    );
    setBucketNotice({
      tone: 'success',
      message: '돈의 목적을 보관했어요. 기존 거래에서는 그대로 표시됩니다.',
    });
  };

  const openResetDialog = () => {
    if (isResetting) {
      return;
    }

    setResetError(undefined);
    setResetNotice(undefined);
    setIsResetDialogOpen(true);
  };

  const closeResetDialog = () => {
    if (!isResetting) {
      setIsResetDialogOpen(false);
    }
  };

  const handleResetLocalLedger = async () => {
    if (isResetting) {
      return;
    }

    setIsResetting(true);
    setResetError(undefined);
    setNotice(undefined);

    try {
      await settingsRepository.resetLocalLedger();
      setSettings(undefined);
      setGoalInput('');
      setEditingBucketId(undefined);
      setBucketReloadVersion((version) => version + 1);
      setIsResetDialogOpen(false);
      setResetNotice('이 브라우저에 저장한 장부 데이터를 초기화했어요.');
    } catch {
      setResetError(
        '로컬 장부를 초기화하지 못했어요. 이 기기의 저장소를 확인한 뒤 다시 시도해 주세요.',
      );
    } finally {
      setIsResetting(false);
    }
  };

  const handleBackupRestored = (backup: LocalLedgerBackup) => {
    const restoredSettings = backup.data.userSettings ?? undefined;
    setSettings(restoredSettings);
    setGoalInput(
      restoredSettings === undefined
        ? ''
        : String(restoredSettings.monthlyLivingExpenseGoalMinor),
    );
    setBudgetBuckets(backup.data.budgetBuckets);
  };

  const currentGoalLabel = isLoading
    ? '목표를 확인하는 중이에요'
    : loadError
      ? '목표를 확인하지 못했어요'
      : settings === undefined
        ? '아직 정하지 않았어요'
        : `${formatWonInput(String(settings.monthlyLivingExpenseGoalMinor))}원`;

  return (
    <section className="settings-page" aria-labelledby="settings-page-title">
      <header className="settings-page-intro">
        <p className="eyebrow">생활비 목표</p>
        <h1 id="settings-page-title">
          생활비 목표를
          <br />
          <em>내 기준으로 정해볼까요?</em>
        </h1>
        <p>
          내 소비 흐름에 맞는 금액을 정하면 홈에서 남은 생활비를 바로 확인할
          수 있어요.
        </p>
      </header>

      <article
        className="settings-card"
        aria-labelledby="monthly-goal-card-title"
      >
        <div className="settings-card-context">
          <span className="settings-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7.5h16v11H4zM7 7.5V5.8C7 4.8 7.8 4 8.8 4h6.4c1 0 1.8.8 1.8 1.8v1.7M8 12h8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="panel-kicker">현재 상태</p>
          <h2 id="monthly-goal-card-title">월 생활비 목표</h2>
          <strong className="settings-current-goal">{currentGoalLabel}</strong>
          <p>
            월간 보기에서 순생활비와 비교해요. 일·주·직접 선택 기간에는 목표를
            나누어 계산하지 않아요.
          </p>
          <small className="settings-local-note">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12v10H6zM12 14v2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            이 브라우저에만 저장하며 외부로 전송하지 않아요.
          </small>
        </div>

        {isLoading ? (
          <p className="settings-loading" role="status" aria-live="polite">
            로컬 설정을 불러오는 중이에요.
          </p>
        ) : loadError ? (
          <div className="settings-load-error" role="alert">
            <p>로컬 설정을 불러오지 못했습니다. 개인 정보는 외부로 전송되지 않았습니다.</p>
            <button
              type="button"
              onClick={() => setReloadVersion((version) => version + 1)}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <form
            className="settings-goal-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="settings-goal-label">
              <label htmlFor="monthly-living-expense-goal">월 생활비 목표</label>
              <p id="monthly-living-expense-goal-help">
                부담 없이 시작해 보세요. 나중에 언제든 바꿀 수 있어요.
              </p>
            </div>
            <div className="settings-money-input">
              <input
                id="monthly-living-expense-goal"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="금액을 입력하세요"
                aria-describedby="monthly-living-expense-goal-help"
                value={formatWonInput(goalInput)}
                disabled={isSaving}
                onChange={(event) =>
                  setGoalInput(sanitizeWonInput(event.currentTarget.value))
                }
              />
              <span aria-hidden="true">원</span>
            </div>
            {notice === undefined ? null : (
              <p
                className={`settings-notice settings-notice--${notice.tone}`}
                role={notice.tone === 'error' ? 'alert' : 'status'}
              >
                {notice.message}
              </p>
            )}
            <div className="settings-goal-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? '저장 중' : '목표 저장'}
              </button>
              <button
                type="button"
                className="settings-clear-action"
                disabled={isSaving || (settings === undefined && goalInput === '')}
                onClick={() => void handleClear()}
              >
                목표 비우기
              </button>
            </div>
          </form>
        )}
      </article>

      <article className="settings-bucket-card" aria-labelledby="budget-bucket-card-title">
        <div className="settings-bucket-card__heading">
          <div>
            <p className="panel-kicker">소비 자금 구분</p>
            <h2 id="budget-bucket-card-title">돈의 목적 관리</h2>
            <p>
              이름과 아이콘은 언제든 바꿀 수 있어요. 기본 목적은 보관할 수 없고,
              보관한 사용자 목적은 새 거래 선택지에서만 빠집니다.
            </p>
          </div>
          <span aria-hidden="true">🗂️</span>
        </div>

        {isBucketLoading ? (
          <p className="settings-bucket-state" role="status">돈의 목적을 불러오는 중이에요.</p>
        ) : bucketLoadError ? (
          <div className="settings-bucket-state" role="alert">
            <p>돈의 목적을 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => setBucketReloadVersion((version) => version + 1)}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
            <ul className="settings-bucket-list" aria-label="사용 중인 돈의 목적">
              {budgetBuckets
                .filter((bucket) => !bucket.isArchived)
                .map((bucket) => (
                  <li key={bucket.id}>
                    <span className="settings-bucket-list__icon" aria-hidden="true">
                      {bucket.icon}
                    </span>
                    <span>
                      <strong>{bucket.name}</strong>
                      <small>{bucket.isDefault ? '기본 목적' : '사용자 목적'}</small>
                    </span>
                    <div>
                      <button
                        type="button"
                        disabled={isBucketSaving}
                        aria-label={`${bucket.name} 이름과 아이콘 편집`}
                        onClick={() => startEditingBucket(bucket)}
                      >
                        편집
                      </button>
                      {bucket.isDefault ? null : (
                        <button
                          type="button"
                          disabled={isBucketSaving}
                          aria-label={`${bucket.name} 보관`}
                          onClick={() => void handleArchiveBucket(bucket)}
                        >
                          보관
                        </button>
                      )}
                    </div>
                  </li>
                ))}
            </ul>

            {editingBucketId === undefined ? null : (
              <form className="settings-bucket-form" onSubmit={(event) => void handleEditBucket(event)}>
                <h3>돈의 목적 편집</h3>
                <label>
                  <span>아이콘</span>
                  <input
                    aria-label="편집할 돈의 목적 아이콘"
                    maxLength={16}
                    value={editingBucketIcon}
                    disabled={isBucketSaving}
                    onChange={(event) => setEditingBucketIcon(event.target.value)}
                  />
                </label>
                <label>
                  <span>이름</span>
                  <input
                    aria-label="편집할 돈의 목적 이름"
                    maxLength={40}
                    value={editingBucketName}
                    disabled={isBucketSaving}
                    onChange={(event) => setEditingBucketName(event.target.value)}
                  />
                </label>
                <div>
                  <button type="submit" disabled={isBucketSaving}>변경 저장</button>
                  <button
                    type="button"
                    disabled={isBucketSaving}
                    onClick={() => setEditingBucketId(undefined)}
                  >
                    취소
                  </button>
                </div>
              </form>
            )}

            <form className="settings-bucket-form" onSubmit={(event) => void handleAddBucket(event)}>
              <h3>새 목적 추가</h3>
              <label>
                <span>아이콘</span>
                <input
                  aria-label="새 돈의 목적 아이콘"
                  maxLength={16}
                  placeholder="예: ✈️"
                  value={newBucketIcon}
                  disabled={isBucketSaving}
                  onChange={(event) => setNewBucketIcon(event.target.value)}
                />
              </label>
              <label>
                <span>이름</span>
                <input
                  aria-label="새 돈의 목적 이름"
                  maxLength={40}
                  placeholder="예: 여행"
                  value={newBucketName}
                  disabled={isBucketSaving}
                  onChange={(event) => setNewBucketName(event.target.value)}
                />
              </label>
              <button type="submit" disabled={isBucketSaving}>
                {isBucketSaving ? '저장 중' : '목적 추가'}
              </button>
            </form>

            {budgetBuckets.some((bucket) => bucket.isArchived) ? (
              <details className="settings-archived-buckets">
                <summary>보관한 목적</summary>
                <ul>
                  {budgetBuckets
                    .filter((bucket) => bucket.isArchived)
                    .map((bucket) => (
                      <li key={bucket.id}>{bucket.icon} {bucket.name}</li>
                    ))}
                </ul>
              </details>
            ) : null}
          </>
        )}

        {bucketNotice === undefined ? null : (
          <p
            className={`settings-notice settings-notice--${bucketNotice.tone}`}
            role={bucketNotice.tone === 'error' ? 'alert' : 'status'}
          >
            {bucketNotice.message}
          </p>
        )}
      </article>

      <LocalLedgerBackupCard
        repository={settingsRepository}
        onRestored={handleBackupRestored}
      />

      <article className="settings-reset-card" aria-labelledby="reset-card-title">
        <div className="settings-reset-card__context">
          <span className="settings-reset-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M6.3 8.2A7.5 7.5 0 0 1 19 11m-1.3 4.8A7.5 7.5 0 0 1 5 13m.1-5.5v3.3h3.3m10.2 5.7v-3.3h-3.3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="panel-kicker">로컬 데이터 관리</p>
          <h2 id="reset-card-title">로컬 장부 초기화</h2>
          <p>
            이 브라우저에 저장한 거래와 설정을 새로 시작하고 싶을 때만 사용하세요.
          </p>
        </div>

        <div className="settings-reset-card__action">
          <p>
            거래 내역, 불러오기 이력, 공동결제 정산, 카테고리 규칙, 월 생활비 목표, 사용자 카테고리와 거래 이미지 첨부를 지우고, 저장한 돈의 목적은 기본 목적 7개로 되돌립니다.
          </p>
          <p className="settings-reset-card__warning">
            원본 엑셀 파일과 컴퓨터의 파일은 지우지 않으며, 초기화한 장부 데이터는 되돌릴 수 없어요.
          </p>
          {resetNotice === undefined ? null : (
            <p className="settings-notice settings-notice--success" role="status">
              {resetNotice}
            </p>
          )}
          <button
            type="button"
            className="settings-reset-trigger"
            disabled={isResetting}
            ref={resetTriggerRef}
            onClick={openResetDialog}
          >
            로컬 장부 초기화
          </button>
        </div>
      </article>

      {isResetDialogOpen ? (
        <div className="settings-reset-layer">
          <button
            type="button"
            className="settings-reset-backdrop"
            aria-label="로컬 장부 초기화 창 닫기"
            disabled={isResetting}
            onClick={closeResetDialog}
          />
          <div
            className="settings-reset-dialog"
            ref={resetDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            aria-describedby="reset-dialog-description"
          >
            <div className="settings-reset-dialog__heading">
              <div>
                <p className="panel-kicker">되돌릴 수 없는 작업</p>
                <h2 id="reset-dialog-title">로컬 장부를 초기화할까요?</h2>
              </div>
              <button
                type="button"
                className="settings-reset-dialog__close"
                aria-label="로컬 장부 초기화 닫기"
                disabled={isResetting}
                onClick={closeResetDialog}
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
            <p id="reset-dialog-description">
              이 브라우저에 저장한 다음 데이터를 모두 지웁니다.
            </p>
            <ul>
              <li>거래 내역과 불러오기 이력</li>
              <li>공동결제 정산 기록</li>
              <li>정확한 이름·포함 키워드 카테고리 규칙</li>
              <li>월 생활비 목표</li>
              <li>사용자 카테고리와 거래 이미지 첨부</li>
              <li>저장한 돈의 목적 설정(초기화 뒤 기본 목적 7개만 다시 만듭니다)</li>
            </ul>
            <p className="settings-reset-dialog__local-note">
              원본 엑셀 파일, 샘플 파일, 앱 코드와 환경 설정은 지우지 않습니다.
            </p>
            {resetError === undefined ? null : (
              <p className="settings-reset-dialog__error" role="alert">
                {resetError}
              </p>
            )}
            <div className="settings-reset-dialog__actions">
              <button
                type="button"
                disabled={isResetting}
                onClick={closeResetDialog}
              >
                취소
              </button>
              <button
                type="button"
                className="settings-reset-confirm"
                disabled={isResetting}
                onClick={() => void handleResetLocalLedger()}
              >
                {isResetting ? '초기화 중' : '모든 로컬 데이터 초기화'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
