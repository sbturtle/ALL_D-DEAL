import { describe, expect, it } from 'vitest';

import {
  estimateTakeHomePay,
  MAX_SUPPORTED_ANNUAL_GROSS_WON,
  PayrollEstimateValidationError,
  validatePayrollEstimateInput,
} from './payroll-estimate';
import type { PayrollEstimateInput } from './payroll-estimate';
import { payrollPolicy2026H2 } from './payroll-policy';

const monthlyInput: PayrollEstimateInput = {
  mode: 'MONTHLY',
  monthlyBaseGrossWon: 4_000_000,
  annualBonusGrossWon: 12_000_000,
  monthlyNonTaxableWon: 200_000,
  dependentsIncludingSelf: 1,
  childrenAges8To20: 0,
  withholdingRatePercent: 100,
};

describe('estimateTakeHomePay', () => {
  it('월급과 연간 상여를 월평균에 한 번만 반영한다', () => {
    const result = estimateTakeHomePay(monthlyInput);

    expect(result.annualBaseGrossWon).toBe(48_000_000);
    expect(result.annualBonusGrossWon).toBe(12_000_000);
    expect(result.monthlyBaseGrossWon).toBe(4_000_000);
    expect(result.monthlyBonusAverageWon).toBe(1_000_000);
    expect(result.monthly.grossWon).toBe(5_000_000);
    expect(result.monthly.taxablePayWon).toBe(4_800_000);
    expect(result.annual.grossWon).toBe(60_000_000);
  });

  it('2026년 보험과 세액을 항목별로 계산한다', () => {
    const result = estimateTakeHomePay(monthlyInput);

    expect(result.monthly.deductions).toEqual({
      nationalPensionWon: 228_000,
      healthInsuranceWon: 172_560,
      longTermCareInsuranceWon: 22_670,
      employmentInsuranceWon: 43_200,
      incomeTaxWon: 307_420,
      localIncomeTaxWon: 30_740,
    });
    expect(result.monthly.totalDeductionsWon).toBe(804_590);
    expect(result.monthly.estimatedTakeHomeWon).toBe(4_195_410);
  });

  it('동일한 연봉 모드와 월급 모드가 같은 결과를 만든다', () => {
    const annualResult = estimateTakeHomePay({
      mode: 'ANNUAL',
      annualBaseGrossWon: 48_000_000,
      annualBonusGrossWon: 12_000_000,
      monthlyNonTaxableWon: 200_000,
      dependentsIncludingSelf: 1,
      childrenAges8To20: 0,
      withholdingRatePercent: 100,
    });
    const monthlyResult = estimateTakeHomePay(monthlyInput);

    expect(annualResult).toEqual(monthlyResult);
  });

  it('공제 합계와 실수령액 불변식을 월·연 단위로 유지한다', () => {
    const result = estimateTakeHomePay(monthlyInput);

    for (const period of [result.monthly, result.annual]) {
      expect(
        Object.values(period.deductions).reduce(
          (total, deduction) => total + deduction,
          0,
        ),
      ).toBe(period.totalDeductionsWon);
      expect(period.grossWon - period.totalDeductionsWon).toBe(
        period.estimatedTakeHomeWon,
      );
      expect(Number.isSafeInteger(period.estimatedTakeHomeWon)).toBe(true);
      expect(period.estimatedTakeHomeWon).toBeGreaterThanOrEqual(0);
    }
  });

  it('국민연금 기준소득과 보험료의 상·하한 및 절사를 적용한다', () => {
    const lowerResult = estimateTakeHomePay({
      ...monthlyInput,
      monthlyBaseGrossWon: 410_999,
      annualBonusGrossWon: 0,
      monthlyNonTaxableWon: 0,
      dependentsIncludingSelf: 11,
    });
    const upperResult = estimateTakeHomePay({
      ...monthlyInput,
      monthlyBaseGrossWon: 200_000_000,
      annualBonusGrossWon: 0,
      monthlyNonTaxableWon: 0,
    });

    expect(lowerResult.monthly.deductions.nationalPensionWon).toBe(19_470);
    expect(upperResult.monthly.deductions.nationalPensionWon).toBe(313_020);
    expect(upperResult.monthly.deductions.healthInsuranceWon).toBe(4_591_740);
  });

  it('정책 ID와 적용 기준일을 결과에 남긴다', () => {
    const result = estimateTakeHomePay(monthlyInput);

    expect(result.policyId).toBe('kr-general-employee-2026-h2-v1');
    expect(result.policyEffectiveFrom).toBe('2026-07-01');
    expect(result.incomeTaxTableEffectiveFrom).toBe('2026-03-01');
  });

  it('잘못된 금액·가족·자녀 입력을 함께 보고한다', () => {
    const invalidInput: PayrollEstimateInput = {
      mode: 'MONTHLY',
      monthlyBaseGrossWon: 400_000,
      annualBonusGrossWon: -1,
      monthlyNonTaxableWon: 500_000,
      dependentsIncludingSelf: 1,
      childrenAges8To20: 1,
      withholdingRatePercent: 100,
    };
    const issues = validatePayrollEstimateInput(invalidInput);

    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        'baseGrossWon',
        'annualBonusGrossWon',
        'monthlyNonTaxableWon',
        'childrenAges8To20',
      ]),
    );
    expect(() => estimateTakeHomePay(invalidInput)).toThrow(
      PayrollEstimateValidationError,
    );
  });

  it('과세 월평균이 0원이 되는 비과세 입력을 거부한다', () => {
    const input: PayrollEstimateInput = {
      ...monthlyInput,
      monthlyBaseGrossWon: 410_000,
      annualBonusGrossWon: 0,
      monthlyNonTaxableWon: 410_000,
    };

    expect(validatePayrollEstimateInput(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'monthlyNonTaxableWon',
          code: 'out_of_range',
        }),
      ]),
    );
    expect(() => estimateTakeHomePay(input)).toThrow(
      PayrollEstimateValidationError,
    );
  });

  it('월급의 연간 환산이 safe integer를 넘으면 검증 오류로 보고한다', () => {
    const input: PayrollEstimateInput = {
      ...monthlyInput,
      monthlyBaseGrossWon: Number.MAX_SAFE_INTEGER,
      annualBonusGrossWon: 0,
      monthlyNonTaxableWon: 0,
    };

    expect(validatePayrollEstimateInput(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'baseGrossWon',
          code: 'out_of_range',
        }),
      ]),
    );
    expect(() => estimateTakeHomePay(input)).toThrow(
      PayrollEstimateValidationError,
    );
  });

  it('지원 상한을 넘는 연봉·월급·상여는 계산하지 않는다', () => {
    const annualInput: PayrollEstimateInput = {
      ...monthlyInput,
      mode: 'ANNUAL',
      annualBaseGrossWon: MAX_SUPPORTED_ANNUAL_GROSS_WON + 1,
      annualBonusGrossWon: MAX_SUPPORTED_ANNUAL_GROSS_WON + 1,
    };
    const monthlyOverInput: PayrollEstimateInput = {
      ...monthlyInput,
      monthlyBaseGrossWon: 250_000_001,
      annualBonusGrossWon: 0,
    };
    const boundaryInput: PayrollEstimateInput = {
      ...monthlyInput,
      mode: 'ANNUAL',
      annualBaseGrossWon: MAX_SUPPORTED_ANNUAL_GROSS_WON,
      annualBonusGrossWon: MAX_SUPPORTED_ANNUAL_GROSS_WON,
    };

    expect(
      validatePayrollEstimateInput(annualInput).map((issue) => [issue.field, issue.code]),
    ).toEqual([
      ['baseGrossWon', 'out_of_range'],
      ['annualBonusGrossWon', 'out_of_range'],
    ]);
    expect(validatePayrollEstimateInput(monthlyOverInput)).toEqual([
      expect.objectContaining({ field: 'baseGrossWon', code: 'out_of_range' }),
    ]);
    expect(validatePayrollEstimateInput(boundaryInput)).toEqual([]);
    expect(() => estimateTakeHomePay(annualInput)).toThrow(
      PayrollEstimateValidationError,
    );
  });

  it('주입된 정책의 국민연금 하한으로 입력 범위를 검증한다', () => {
    const policyWithHigherPensionFloor = {
      ...payrollPolicy2026H2,
      nationalPension: {
        ...payrollPolicy2026H2.nationalPension,
        minimumStandardIncomeWon: 500_000,
      },
    };
    const input: PayrollEstimateInput = {
      ...monthlyInput,
      monthlyBaseGrossWon: 450_000,
      annualBonusGrossWon: 0,
      monthlyNonTaxableWon: 0,
    };

    expect(
      validatePayrollEstimateInput(input, policyWithHigherPensionFloor),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'baseGrossWon',
          code: 'out_of_range',
        }),
      ]),
    );
  });
});
