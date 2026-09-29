import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';

import type { WithholdingRatePercent } from '../../domain/payroll-estimate/income-tax';
import {
  estimateTakeHomePay,
  PayrollEstimateValidationError,
  validatePayrollEstimateInput,
} from '../../domain/payroll-estimate/payroll-estimate';
import type {
  PayrollEstimateInput,
  PayrollEstimateIssue,
  PayrollEstimateResult,
} from '../../domain/payroll-estimate/payroll-estimate';
import { payrollPolicy2026H2 } from '../../domain/payroll-estimate/payroll-policy';
import {
  formatWon,
  formatWonInput,
  parseWonInput,
  sanitizeWonInput,
} from '../../shared/format/currency';

type InputMode = PayrollEstimateInput['mode'];
type MoneyFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  help: string;
  error?: string;
  onChange: (value: string) => void;
};

const INITIAL_ANNUAL_BASE = '';
const INITIAL_MONTHLY_BASE = '';
const INITIAL_BONUS = '0';
const INITIAL_NON_TAXABLE = '0';

function MoneyField({
  id,
  label,
  value,
  placeholder,
  help,
  error,
  onChange,
}: MoneyFieldProps) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <div className={`form-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="money-input">
        <span aria-hidden="true">₩</span>
        <input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          maxLength={21}
          value={formatWonInput(value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
          onChange={(event) => onChange(sanitizeWonInput(event.target.value))}
        />
        <small>원</small>
      </div>
      <p id={descriptionId} className="field-help">
        {help}
      </p>
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getIssueMessage(
  issues: readonly PayrollEstimateIssue[],
  field: PayrollEstimateIssue['field'],
): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}

function buildDeductionItems(result: PayrollEstimateResult) {
  const deductions = result.monthly.deductions;

  return [
    {
      label: '국민연금',
      amountWon: deductions.nationalPensionWon,
      tone: 'mint',
    },
    {
      label: '건강보험',
      amountWon: deductions.healthInsuranceWon,
      tone: 'blue',
    },
    {
      label: '장기요양보험',
      amountWon: deductions.longTermCareInsuranceWon,
      tone: 'violet',
    },
    {
      label: '고용보험',
      amountWon: deductions.employmentInsuranceWon,
      tone: 'yellow',
    },
    {
      label: '근로소득세',
      amountWon: deductions.incomeTaxWon,
      tone: 'coral',
    },
    {
      label: '지방소득세',
      amountWon: deductions.localIncomeTaxWon,
      tone: 'gray',
    },
  ] as const;
}

type EstimateResultProps = {
  result: PayrollEstimateResult;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

function formatPolicyDate(isoDate: string): string {
  return isoDate.replaceAll('-', '.');
}

function formatPolicyEffectiveDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);

  return `${year}년 ${month}월 ${day}일 시행`;
}

function EstimateResult({ result, headingRef }: EstimateResultProps) {
  const takeHomeRate = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (result.monthly.estimatedTakeHomeWon / result.monthly.grossWon) * 100,
      ),
    ),
  );
  const deductionRate = 100 - takeHomeRate;
  const deductionItems = buildDeductionItems(result);

  return (
    <div className="estimate-result" aria-live="polite">
      <div className="result-heading">
        <span className="result-label">월평균 예상 실수령액</span>
        <h2 ref={headingRef} tabIndex={-1}>
          {formatWon(result.monthly.estimatedTakeHomeWon)}
        </h2>
        <p>
          연간 예상 실수령액{' '}
          <strong>{formatWon(result.annual.estimatedTakeHomeWon)}</strong>
        </p>
      </div>

      <div className="take-home-ratio">
        <div className="ratio-copy">
          <span>예상 수령 {takeHomeRate}%</span>
          <span>예상 공제 {deductionRate}%</span>
        </div>
        <div className="ratio-track" aria-hidden="true">
          <span style={{ width: `${takeHomeRate}%` }} />
        </div>
      </div>

      <dl className="result-snapshot">
        <div>
          <dt>상여 포함 연 세전</dt>
          <dd>{formatWon(result.annual.grossWon)}</dd>
        </div>
        <div>
          <dt>월평균 세전</dt>
          <dd>{formatWon(result.monthly.grossWon)}</dd>
        </div>
        <div>
          <dt>월평균 과세급여</dt>
          <dd>{formatWon(result.monthly.taxablePayWon)}</dd>
        </div>
        <div>
          <dt>월평균 상여 반영</dt>
          <dd>+{formatWon(result.monthlyBonusAverageWon)}</dd>
        </div>
      </dl>

      <div className="deduction-block">
        <div className="deduction-heading">
          <div>
            <span>월평균 예상 공제</span>
            <strong>{formatWon(result.monthly.totalDeductionsWon)}</strong>
          </div>
          <small>10원 미만 절사</small>
        </div>
        <ul className="deduction-list">
          {deductionItems.map((item) => (
            <li key={item.label}>
              <span>
                <i className={`dot dot--${item.tone}`} aria-hidden="true" />
                {item.label}
              </span>
              <strong>{formatWon(item.amountWon)}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="bonus-caution">
        <span aria-hidden="true">!</span>
        <p>
          상여금은 연간 총액을 12개월로 나눈 <strong>월평균 추정</strong>입니다.
          실제 상여 지급월의 세액과 실수령액은 다를 수 있습니다.
        </p>
      </div>

      <details className="policy-details">
        <summary>계산 기준과 꼭 알아둘 점</summary>
        <div className="policy-content">
          <p>
            <strong>{payrollPolicy2026H2.label}</strong>
            <br />
            정책 기준{' '}
            <time dateTime={result.policyEffectiveFrom}>
              {formatPolicyDate(result.policyEffectiveFrom)}
            </time>
            {' · '}세액표 시행{' '}
            <time dateTime={result.incomeTaxTableEffectiveFrom}>
              {formatPolicyDate(result.incomeTaxTableEffectiveFrom)}
            </time>
          </p>
          <ul>
            <li>4대보험에 모두 가입한 일반 직장근로자를 가정합니다.</li>
            <li>
              국민연금·건강보험은 월평균 보수를 사용한 간편 추정이라 회사 신고
              보수와 정산분에 따라 달라질 수 있습니다.
            </li>
            <li>
              연말정산, 보험 감면·가입 제외, 퇴직금과 회사별 추가 공제는 포함하지
              않습니다.
            </li>
            <li>입력값과 결과는 현재 화면에서만 사용하며 저장하지 않습니다.</li>
          </ul>
          <div className="source-links">
            {payrollPolicy2026H2.sources.map((source) => (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                key={source.url}
              >
                {source.label}
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

export function PayrollEstimateCalculator() {
  const [mode, setMode] = useState<InputMode>('ANNUAL');
  const [annualBaseWon, setAnnualBaseWon] = useState(INITIAL_ANNUAL_BASE);
  const [monthlyBaseWon, setMonthlyBaseWon] = useState(INITIAL_MONTHLY_BASE);
  const [annualBonusWon, setAnnualBonusWon] = useState(INITIAL_BONUS);
  const [monthlyNonTaxableWon, setMonthlyNonTaxableWon] = useState(
    INITIAL_NON_TAXABLE,
  );
  const [dependents, setDependents] = useState(1);
  const [children, setChildren] = useState(0);
  const [withholdingRate, setWithholdingRate] =
    useState<WithholdingRatePercent>(100);
  const [issues, setIssues] = useState<readonly PayrollEstimateIssue[]>([]);
  const [unexpectedError, setUnexpectedError] = useState('');
  const [result, setResult] = useState<PayrollEstimateResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const childOptions = useMemo(
    () => Array.from({ length: dependents }, (_, index) => index),
    [dependents],
  );

  useEffect(() => {
    if (result) {
      resultHeadingRef.current?.focus();
    }
  }, [result]);

  useEffect(() => {
    if (issues.length > 0) {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    }
  }, [issues]);

  const createInput = (): PayrollEstimateInput => {
    const commonInput = {
      annualBonusGrossWon: parseWonInput(annualBonusWon),
      monthlyNonTaxableWon: parseWonInput(monthlyNonTaxableWon),
      dependentsIncludingSelf: dependents,
      childrenAges8To20: children,
      withholdingRatePercent: withholdingRate,
    };

    return mode === 'ANNUAL'
      ? {
          ...commonInput,
          mode,
          annualBaseGrossWon: parseWonInput(annualBaseWon),
        }
      : {
          ...commonInput,
          mode,
          monthlyBaseGrossWon: parseWonInput(monthlyBaseWon),
        };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = createInput();
    const nextIssues = validatePayrollEstimateInput(input);

    setIssues(nextIssues);
    setUnexpectedError('');

    if (nextIssues.length > 0) {
      setResult(null);
      return;
    }

    try {
      setResult(estimateTakeHomePay(input));
    } catch (error: unknown) {
      if (error instanceof PayrollEstimateValidationError) {
        setIssues(error.issues);
      } else {
        setUnexpectedError('계산을 완료하지 못했습니다. 입력값을 다시 확인해 주세요.');
      }
      setResult(null);
    }
  };

  const handleReset = () => {
    setMode('ANNUAL');
    setAnnualBaseWon(INITIAL_ANNUAL_BASE);
    setMonthlyBaseWon(INITIAL_MONTHLY_BASE);
    setAnnualBonusWon(INITIAL_BONUS);
    setMonthlyNonTaxableWon(INITIAL_NON_TAXABLE);
    setDependents(1);
    setChildren(0);
    setWithholdingRate(100);
    setIssues([]);
    setUnexpectedError('');
    setResult(null);
  };

  const handleModeChange = (nextMode: InputMode) => {
    setMode(nextMode);
    setIssues([]);
    setUnexpectedError('');
    setResult(null);
  };

  const handleDependentsChange = (nextDependents: number) => {
    setDependents(nextDependents);
    if (children >= nextDependents) {
      setChildren(0);
    }
  };

  const baseError = getIssueMessage(issues, 'baseGrossWon');
  const bonusError = getIssueMessage(issues, 'annualBonusGrossWon');
  const nonTaxableError = getIssueMessage(issues, 'monthlyNonTaxableWon');
  const familyError = getIssueMessage(issues, 'dependentsIncludingSelf');
  const childrenError = getIssueMessage(issues, 'childrenAges8To20');

  return (
    <section
      className="calculator-card"
      id="calculator"
      aria-labelledby="calculator-title"
    >
      <div className="calculator-form-panel">
        <div className="calculator-heading">
          <div>
            <span className="step-label">01 · 입력</span>
            <h2 id="calculator-title">급여 조건</h2>
          </div>
          <span className="local-badge">
            <i aria-hidden="true" /> 입력값 저장 안 함
          </span>
        </div>

        <form
          id="payroll-estimate-form"
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
        >
          <fieldset className="mode-fieldset">
            <legend>기본 급여 입력 방식</legend>
            <div className="mode-switch">
              <button
                type="button"
                className={mode === 'ANNUAL' ? 'is-active' : undefined}
                aria-pressed={mode === 'ANNUAL'}
                onClick={() => handleModeChange('ANNUAL')}
              >
                연봉으로 계산
              </button>
              <button
                type="button"
                className={mode === 'MONTHLY' ? 'is-active' : undefined}
                aria-pressed={mode === 'MONTHLY'}
                onClick={() => handleModeChange('MONTHLY')}
              >
                월급으로 계산
              </button>
            </div>
          </fieldset>

          <div className="money-fields">
            {mode === 'ANNUAL' ? (
              <MoneyField
                id="annual-base-gross"
                label="세전 기본 연봉"
                value={annualBaseWon}
                placeholder="예: 48,000,000"
                help="상여·퇴직금 제외, 비과세 수당은 포함"
                error={baseError}
                onChange={setAnnualBaseWon}
              />
            ) : (
              <MoneyField
                id="monthly-base-gross"
                label="월 세전 기본급"
                value={monthlyBaseWon}
                placeholder="예: 4,000,000"
                help="상여 제외, 비과세 수당은 포함"
                error={baseError}
                onChange={setMonthlyBaseWon}
              />
            )}

            <MoneyField
              id="annual-bonus-gross"
              label="연간 상여금"
              value={annualBonusWon}
              placeholder="0"
              help="기본 급여에 포함되지 않은 세전 총액"
              error={bonusError}
              onChange={setAnnualBonusWon}
            />

            <MoneyField
              id="monthly-non-taxable"
              label="월 비과세액"
              value={monthlyNonTaxableWon}
              placeholder="0"
              help="기본 급여 안에 이미 포함된 식대 등"
              error={nonTaxableError}
              onChange={setMonthlyNonTaxableWon}
            />
          </div>

          <div className="select-fields">
            <div className={`form-field ${familyError ? 'has-error' : ''}`}>
              <label htmlFor="dependents">공제대상 가족</label>
              <div className="select-control">
                <select
                  id="dependents"
                  value={dependents}
                  aria-invalid={Boolean(familyError)}
                  aria-describedby={`dependents-description${familyError ? ' dependents-error' : ''}`}
                  onChange={(event) =>
                    handleDependentsChange(Number(event.target.value))
                  }
                >
                  {Array.from({ length: 11 }, (_, index) => index + 1).map(
                    (count) => (
                      <option value={count} key={count}>
                        {count}명
                      </option>
                    ),
                  )}
                </select>
              </div>
              <p id="dependents-description" className="field-help">
                본인을 포함한 기본공제 대상자
              </p>
              {familyError ? (
                <p id="dependents-error" className="field-error" role="alert">
                  {familyError}
                </p>
              ) : null}
            </div>

            <div className={`form-field ${childrenError ? 'has-error' : ''}`}>
              <label htmlFor="children">8~20세 자녀</label>
              <div className="select-control">
                <select
                  id="children"
                  value={children}
                  aria-invalid={Boolean(childrenError)}
                  aria-describedby={`children-description${childrenError ? ' children-error' : ''}`}
                  onChange={(event) => setChildren(Number(event.target.value))}
                >
                  {childOptions.map((count) => (
                    <option value={count} key={count}>
                      {count}명
                    </option>
                  ))}
                </select>
              </div>
              <p id="children-description" className="field-help">
                소득 요건을 충족한 공제대상 자녀
              </p>
              {childrenError ? (
                <p id="children-error" className="field-error" role="alert">
                  {childrenError}
                </p>
              ) : null}
            </div>
          </div>

          <fieldset className="withholding-fieldset">
            <legend>
              소득세 원천징수 비율
              <span>미신청 시 100%</span>
            </legend>
            <div className="withholding-options">
              {([80, 100, 120] as const).map((rate) => (
                <label key={rate}>
                  <input
                    type="radio"
                    name="withholding-rate"
                    value={rate}
                    checked={withholdingRate === rate}
                    onChange={() => setWithholdingRate(rate)}
                  />
                  <span>{rate}%</span>
                </label>
              ))}
            </div>
          </fieldset>

          {unexpectedError ? (
            <p className="form-global-error" role="alert">
              {unexpectedError}
            </p>
          ) : null}

          <div className="form-actions">
            <button className="primary-action" type="submit">
              예상 실수령액 계산
              <span aria-hidden="true">→</span>
            </button>
            <button className="reset-action" type="button" onClick={handleReset}>
              초기화
            </button>
          </div>
        </form>
      </div>

      <aside className="calculator-result-panel" aria-label="급여 추정 결과">
        <div className="result-panel-heading">
          <span className="step-label">02 · 결과</span>
          <span>
            <time dateTime={payrollPolicy2026H2.effectiveFrom}>
              {formatPolicyEffectiveDate(payrollPolicy2026H2.effectiveFrom)} 요율 적용
            </time>
          </span>
        </div>

        {result ? (
          <EstimateResult result={result} headingRef={resultHeadingRef} />
        ) : (
          <div className="result-empty" aria-live="polite">
            <div className="empty-orbit" aria-hidden="true">
              <span>₩</span>
            </div>
            <div>
              <strong>급여 조건을 입력해 주세요</strong>
              <p>
                상여까지 월평균에 반영해 예상 수령액과 6가지 공제 내역을
                보여드릴게요.
              </p>
            </div>
            <ul>
              <li>2026년 공식 세액표 기반</li>
              <li>일반 직장근로자 기준</li>
              <li>브라우저 안에서만 계산</li>
            </ul>
          </div>
        )}
      </aside>
    </section>
  );
}
