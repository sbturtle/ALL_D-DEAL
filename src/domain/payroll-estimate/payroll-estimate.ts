import { calculateIncomeTaxes } from './income-tax';
import type { WithholdingRatePercent } from './income-tax';
import { floorRatio, floorToUnit, sumSafeIntegers } from './money';
import { payrollPolicy2026H2 } from './payroll-policy';
import type { PayrollPolicy } from './payroll-policy';

type PayrollEstimateCommonInput = {
  annualBonusGrossWon: number;
  monthlyNonTaxableWon: number;
  dependentsIncludingSelf: number;
  childrenAges8To20: number;
  withholdingRatePercent: WithholdingRatePercent;
};

export type PayrollEstimateInput =
  | (PayrollEstimateCommonInput & {
      mode: 'ANNUAL';
      annualBaseGrossWon: number;
    })
  | (PayrollEstimateCommonInput & {
      mode: 'MONTHLY';
      monthlyBaseGrossWon: number;
    });

export type PayrollEstimateIssue = {
  field:
    | 'baseGrossWon'
    | 'annualBonusGrossWon'
    | 'monthlyNonTaxableWon'
    | 'dependentsIncludingSelf'
    | 'childrenAges8To20'
    | 'withholdingRatePercent';
  code:
    | 'required'
    | 'invalid_money'
    | 'out_of_range'
    | 'exceeds_base_pay'
    | 'invalid_family_count'
    | 'invalid_child_count'
    | 'invalid_withholding_rate';
  message: string;
};

export class PayrollEstimateValidationError extends Error {
  readonly issues: readonly PayrollEstimateIssue[];

  constructor(issues: readonly PayrollEstimateIssue[]) {
    super('급여 추정 입력값을 확인해 주세요.');
    this.name = 'PayrollEstimateValidationError';
    this.issues = issues;
  }
}

export type PayrollDeductionBreakdown = {
  nationalPensionWon: number;
  healthInsuranceWon: number;
  longTermCareInsuranceWon: number;
  employmentInsuranceWon: number;
  incomeTaxWon: number;
  localIncomeTaxWon: number;
};

export type PayrollEstimatePeriodResult = {
  grossWon: number;
  taxablePayWon: number;
  deductions: PayrollDeductionBreakdown;
  totalDeductionsWon: number;
  estimatedTakeHomeWon: number;
};

export type PayrollEstimateResult = {
  policyId: string;
  policyEffectiveFrom: string;
  incomeTaxTableEffectiveFrom: string;
  annualBaseGrossWon: number;
  annualBonusGrossWon: number;
  monthlyBaseGrossWon: number;
  monthlyBonusAverageWon: number;
  monthlyNonTaxableWon: number;
  monthly: PayrollEstimatePeriodResult;
  annual: PayrollEstimatePeriodResult;
};

const MONTHS_PER_YEAR = 12;
// 건강보험 보수월액 상한(월 약 1.28억 원)까지 계산하되, 입력 겹침 같은 비현실적 값은 막는다.
export const MAX_SUPPORTED_ANNUAL_GROSS_WON = 3_000_000_000;
const VALID_WITHHOLDING_RATES: readonly WithholdingRatePercent[] = [
  80, 100, 120,
];

function isValidMoney(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function getAnnualBaseGrossWon(input: PayrollEstimateInput): number {
  if (input.mode === 'ANNUAL') {
    return input.annualBaseGrossWon;
  }

  const annualBaseGrossWon = input.monthlyBaseGrossWon * MONTHS_PER_YEAR;

  if (!Number.isSafeInteger(annualBaseGrossWon)) {
    return Number.NaN;
  }

  return annualBaseGrossWon;
}

function getBaseGrossWon(input: PayrollEstimateInput): number {
  return input.mode === 'ANNUAL'
    ? input.annualBaseGrossWon
    : input.monthlyBaseGrossWon;
}

export function validatePayrollEstimateInput(
  input: PayrollEstimateInput,
  policy: PayrollPolicy = payrollPolicy2026H2,
): readonly PayrollEstimateIssue[] {
  const issues: PayrollEstimateIssue[] = [];
  const baseGrossWon = getBaseGrossWon(input);
  const annualBaseGrossWon = getAnnualBaseGrossWon(input);

  if (!isValidMoney(baseGrossWon)) {
    issues.push({
      field: 'baseGrossWon',
      code: 'invalid_money',
      message: '기본 급여는 0원 이상의 원 단위 정수여야 합니다.',
    });
  } else if (baseGrossWon === 0) {
    issues.push({
      field: 'baseGrossWon',
      code: 'required',
      message: '기본 급여를 입력해 주세요.',
    });
  }

  if (
    input.mode === 'MONTHLY' &&
    isValidMoney(input.monthlyBaseGrossWon) &&
    !Number.isSafeInteger(annualBaseGrossWon)
  ) {
    issues.push({
      field: 'baseGrossWon',
      code: 'out_of_range',
      message: '월 기본 급여를 연간으로 환산하면 계산 가능한 범위를 벗어납니다.',
    });
  }

  if (!isValidMoney(input.annualBonusGrossWon)) {
    issues.push({
      field: 'annualBonusGrossWon',
      code: 'invalid_money',
      message: '연간 상여금은 0원 이상의 원 단위 정수여야 합니다.',
    });
  }

  if (!isValidMoney(input.monthlyNonTaxableWon)) {
    issues.push({
      field: 'monthlyNonTaxableWon',
      code: 'invalid_money',
      message: '월 비과세액은 0원 이상의 원 단위 정수여야 합니다.',
    });
  }

  if (
    isValidMoney(annualBaseGrossWon) &&
    annualBaseGrossWon > MAX_SUPPORTED_ANNUAL_GROSS_WON &&
    !issues.some((issue) => issue.field === 'baseGrossWon')
  ) {
    issues.push({
      field: 'baseGrossWon',
      code: 'out_of_range',
      message:
        '기본 급여는 연 30억 원(월 2억 5천만 원) 이하까지 계산할 수 있어요. 입력값을 다시 확인해 주세요.',
    });
  }

  if (
    isValidMoney(input.annualBonusGrossWon) &&
    input.annualBonusGrossWon > MAX_SUPPORTED_ANNUAL_GROSS_WON
  ) {
    issues.push({
      field: 'annualBonusGrossWon',
      code: 'out_of_range',
      message: '연간 상여금은 30억 원 이하까지 계산할 수 있어요. 입력값을 다시 확인해 주세요.',
    });
  }

  if (
    isValidMoney(annualBaseGrossWon) &&
    isValidMoney(input.annualBonusGrossWon) &&
    !Number.isSafeInteger(annualBaseGrossWon + input.annualBonusGrossWon)
  ) {
    issues.push({
      field: 'baseGrossWon',
      code: 'out_of_range',
      message: '기본 급여와 상여금의 합계가 계산 가능한 범위를 벗어났습니다.',
    });
  }

  if (isValidMoney(annualBaseGrossWon) && annualBaseGrossWon > 0) {
    const monthlyBaseGrossWon = Math.floor(
      annualBaseGrossWon / MONTHS_PER_YEAR,
    );

    if (
      monthlyBaseGrossWon <
      policy.nationalPension.minimumStandardIncomeWon
    ) {
      issues.push({
        field: 'baseGrossWon',
        code: 'out_of_range',
        message: `일반 직장근로자 추정은 월 환산 기본 급여 ${policy.nationalPension.minimumStandardIncomeWon.toLocaleString('ko-KR')}원부터 지원합니다.`,
      });
    }

    if (
      isValidMoney(input.monthlyNonTaxableWon) &&
      input.monthlyNonTaxableWon > monthlyBaseGrossWon
    ) {
      issues.push({
        field: 'monthlyNonTaxableWon',
        code: 'exceeds_base_pay',
        message: '월 비과세액은 월 환산 기본 급여를 초과할 수 없습니다.',
      });
    }

    if (
      isValidMoney(input.annualBonusGrossWon) &&
      isValidMoney(input.monthlyNonTaxableWon) &&
      Number.isSafeInteger(annualBaseGrossWon + input.annualBonusGrossWon)
    ) {
      const monthlyGrossWon = Math.floor(
        (annualBaseGrossWon + input.annualBonusGrossWon) / MONTHS_PER_YEAR,
      );

      if (input.monthlyNonTaxableWon >= monthlyGrossWon) {
        issues.push({
          field: 'monthlyNonTaxableWon',
          code: 'out_of_range',
          message: '월평균 과세급여가 0원보다 커지도록 비과세액을 입력해 주세요.',
        });
      }
    }
  }

  if (
    !Number.isInteger(input.dependentsIncludingSelf) ||
    input.dependentsIncludingSelf < 1 ||
    input.dependentsIncludingSelf > 11
  ) {
    issues.push({
      field: 'dependentsIncludingSelf',
      code: 'invalid_family_count',
      message: '공제대상 가족 수는 본인을 포함해 1명부터 11명까지 입력해 주세요.',
    });
  }

  if (
    !Number.isInteger(input.childrenAges8To20) ||
    input.childrenAges8To20 < 0 ||
    input.childrenAges8To20 >= input.dependentsIncludingSelf
  ) {
    issues.push({
      field: 'childrenAges8To20',
      code: 'invalid_child_count',
      message: '자녀 수는 0명 이상이며 공제대상 가족 수보다 작아야 합니다.',
    });
  }

  if (!VALID_WITHHOLDING_RATES.includes(input.withholdingRatePercent)) {
    issues.push({
      field: 'withholdingRatePercent',
      code: 'invalid_withholding_rate',
      message: '원천징수 비율은 80%, 100%, 120% 중에서 선택해 주세요.',
    });
  }

  return issues;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function calculateMonthlyDeductions(
  taxableMonthlyPayWon: number,
  input: PayrollEstimateInput,
  policy: PayrollPolicy,
): PayrollDeductionBreakdown {
  if (taxableMonthlyPayWon === 0) {
    return {
      nationalPensionWon: 0,
      healthInsuranceWon: 0,
      longTermCareInsuranceWon: 0,
      employmentInsuranceWon: 0,
      incomeTaxWon: 0,
      localIncomeTaxWon: 0,
    };
  }

  const pensionStandardIncomeWon = clamp(
    floorToUnit(
      taxableMonthlyPayWon,
      policy.nationalPension.standardIncomeUnitWon,
    ),
    policy.nationalPension.minimumStandardIncomeWon,
    policy.nationalPension.maximumStandardIncomeWon,
  );
  const nationalPensionWon = floorToUnit(
    floorRatio(
      pensionStandardIncomeWon,
      policy.nationalPension.employeeRateNumerator,
      policy.nationalPension.rateDenominator,
    ),
    10,
  );
  const healthInsuranceBeforeLimitWon = floorRatio(
    taxableMonthlyPayWon,
    policy.healthInsurance.employeeRateNumerator,
    policy.healthInsurance.rateDenominator,
  );
  const healthInsuranceWon = floorToUnit(
    clamp(
      healthInsuranceBeforeLimitWon,
      policy.healthInsurance.minimumEmployeePremiumWon,
      policy.healthInsurance.maximumEmployeePremiumWon,
    ),
    10,
  );
  const longTermCareInsuranceWon = floorToUnit(
    floorRatio(
      healthInsuranceWon,
      policy.longTermCare.healthPremiumRatioNumerator,
      policy.longTermCare.healthPremiumRatioDenominator,
    ),
    10,
  );
  const employmentInsuranceWon = floorToUnit(
    floorRatio(
      taxableMonthlyPayWon,
      policy.employmentInsurance.employeeRateNumerator,
      policy.employmentInsurance.rateDenominator,
    ),
    10,
  );
  const { incomeTaxWon, localIncomeTaxWon } = calculateIncomeTaxes(
    {
      taxableMonthlyPayWon,
      dependentsIncludingSelf: input.dependentsIncludingSelf,
      childrenAges8To20: input.childrenAges8To20,
      withholdingRatePercent: input.withholdingRatePercent,
    },
    policy,
  );

  return {
    nationalPensionWon,
    healthInsuranceWon,
    longTermCareInsuranceWon,
    employmentInsuranceWon,
    incomeTaxWon,
    localIncomeTaxWon,
  };
}

function getDeductionTotal(
  deductions: PayrollDeductionBreakdown,
): number {
  return sumSafeIntegers(Object.values(deductions));
}

function multiplyDeductions(
  deductions: PayrollDeductionBreakdown,
  multiplier: number,
): PayrollDeductionBreakdown {
  return {
    nationalPensionWon: deductions.nationalPensionWon * multiplier,
    healthInsuranceWon: deductions.healthInsuranceWon * multiplier,
    longTermCareInsuranceWon:
      deductions.longTermCareInsuranceWon * multiplier,
    employmentInsuranceWon: deductions.employmentInsuranceWon * multiplier,
    incomeTaxWon: deductions.incomeTaxWon * multiplier,
    localIncomeTaxWon: deductions.localIncomeTaxWon * multiplier,
  };
}

export function estimateTakeHomePay(
  input: PayrollEstimateInput,
  policy: PayrollPolicy = payrollPolicy2026H2,
): PayrollEstimateResult {
  const issues = validatePayrollEstimateInput(input, policy);

  if (issues.length > 0) {
    throw new PayrollEstimateValidationError(issues);
  }

  const annualBaseGrossWon = getAnnualBaseGrossWon(input);
  const annualGrossWon = sumSafeIntegers([
    annualBaseGrossWon,
    input.annualBonusGrossWon,
  ]);
  const monthlyBaseGrossWon = Math.floor(
    annualBaseGrossWon / MONTHS_PER_YEAR,
  );
  const monthlyGrossWon = Math.floor(annualGrossWon / MONTHS_PER_YEAR);
  const monthlyBonusAverageWon = monthlyGrossWon - monthlyBaseGrossWon;
  const monthlyTaxablePayWon = Math.max(
    monthlyGrossWon - input.monthlyNonTaxableWon,
    0,
  );
  const monthlyDeductions = calculateMonthlyDeductions(
    monthlyTaxablePayWon,
    input,
    policy,
  );
  const monthlyTotalDeductionsWon = getDeductionTotal(monthlyDeductions);
  const monthlyEstimatedTakeHomeWon =
    monthlyGrossWon - monthlyTotalDeductionsWon;

  if (monthlyEstimatedTakeHomeWon < 0) {
    throw new RangeError('예상 공제액이 월평균 세전 급여를 초과했습니다.');
  }

  const annualDeductions = multiplyDeductions(
    monthlyDeductions,
    MONTHS_PER_YEAR,
  );
  const annualTotalDeductionsWon = getDeductionTotal(annualDeductions);

  return {
    policyId: policy.id,
    policyEffectiveFrom: policy.effectiveFrom,
    incomeTaxTableEffectiveFrom: policy.incomeTaxTableEffectiveFrom,
    annualBaseGrossWon,
    annualBonusGrossWon: input.annualBonusGrossWon,
    monthlyBaseGrossWon,
    monthlyBonusAverageWon,
    monthlyNonTaxableWon: input.monthlyNonTaxableWon,
    monthly: {
      grossWon: monthlyGrossWon,
      taxablePayWon: monthlyTaxablePayWon,
      deductions: monthlyDeductions,
      totalDeductionsWon: monthlyTotalDeductionsWon,
      estimatedTakeHomeWon: monthlyEstimatedTakeHomeWon,
    },
    annual: {
      grossWon: annualGrossWon,
      taxablePayWon: monthlyTaxablePayWon * MONTHS_PER_YEAR,
      deductions: annualDeductions,
      totalDeductionsWon: annualTotalDeductionsWon,
      estimatedTakeHomeWon: annualGrossWon - annualTotalDeductionsWon,
    },
  };
}
