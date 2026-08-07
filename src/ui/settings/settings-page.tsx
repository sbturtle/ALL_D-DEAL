import { useEffect, useState, type FormEvent } from 'react';

import {
  clearMonthlyLivingExpenseGoal,
  saveMonthlyLivingExpenseGoal,
} from '../../application/settings/manage-monthly-living-expense-goal';
import type { LocalUserSettings } from '../../domain/settings/local-user-settings';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';
import type { BrowserLedgerRepository } from '../../infrastructure/storage/browser-ledger-repository';
import {
  formatWonInput,
  parseWonInput,
  sanitizeWonInput,
} from '../../shared/format/currency';
import './settings-page-refresh.css';

export type LocalSettingsRepository = Pick<
  BrowserLedgerRepository,
  | 'getLocalUserSettings'
  | 'saveLocalUserSettings'
  | 'removeLocalUserSettings'
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
    </section>
  );
}
