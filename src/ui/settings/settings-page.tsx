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

  return (
    <section className="settings-page" aria-labelledby="settings-page-title">
      <div className="settings-page-intro">
        <p className="eyebrow">LOCAL SETTINGS</p>
        <h1 id="settings-page-title">
          생활비 목표를
          <br />
          내 기준으로 설정하세요.
        </h1>
        <p>
          설정한 월 목표와 장부의 순생활비를 비교합니다. 공동결제 정산은 내가 실제로 부담한 금액만 반영됩니다.
        </p>
      </div>

      <article className="settings-card">
        <div className="settings-card-context">
          <span aria-hidden="true">◎</span>
          <p className="panel-kicker">MONTHLY GOAL</p>
          <h2>월 생활비 목표</h2>
          <p>
            목표는 이번 달 장부에서만 계산합니다. 일·주·직접 선택 기간에는 목표를 일할 계산하지 않습니다.
          </p>
          <small>입력값은 이 브라우저의 로컬 저장소에만 보관되며 외부로 전송하지 않습니다.</small>
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
          <form className="settings-goal-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="settings-goal-label">
              <label htmlFor="monthly-living-expense-goal">월 생활비 목표</label>
              <p id="monthly-living-expense-goal-help">
                원 단위의 양의 정수만 저장할 수 있습니다.
              </p>
            </div>
            <div className="settings-money-input">
              <input
                id="monthly-living-expense-goal"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="원 단위로 입력"
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
