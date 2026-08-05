import { describe, expect, it } from 'vitest';

import {
  incomeTaxAtTenMillion2026,
  incomeTaxTable2026,
} from './income-tax-table-2026';
import { calculateIncomeTaxes } from './income-tax';
import { payrollPolicy2026H2 } from './payroll-policy';

describe('2026년 근로소득 간이세액표', () => {
  it('공식 표의 646개 구간이 빈틈 없이 이어진다', () => {
    expect(incomeTaxTable2026).toHaveLength(646);
    expect(incomeTaxTable2026[0]?.slice(0, 2)).toEqual([
      770_000, 775_000,
    ]);
    expect(incomeTaxTable2026.at(-1)?.slice(0, 2)).toEqual([
      9_980_000, 10_000_000,
    ]);
    expect(incomeTaxAtTenMillion2026).toHaveLength(11);

    for (const [index, row] of incomeTaxTable2026.entries()) {
      expect(row).toHaveLength(13);

      const nextRow = incomeTaxTable2026[index + 1];
      if (nextRow) {
        expect(row[1]).toBe(nextRow[0]);
      }
    }
  });

  it('공식 대표값의 자녀 차감과 지방소득세를 계산한다', () => {
    const result = calculateIncomeTaxes(
      {
        taxableMonthlyPayWon: 3_500_000,
        dependentsIncludingSelf: 4,
        childrenAges8To20: 2,
        withholdingRatePercent: 100,
      },
      payrollPolicy2026H2,
    );

    expect(result).toEqual({
      incomeTaxWon: 3_510,
      localIncomeTaxWon: 350,
    });
  });

  it.each([
    [80, 2_800, 280],
    [100, 3_510, 350],
    [120, 4_210, 420],
  ] as const)(
    '원천징수 %i%%를 10원 미만 절사해 적용한다',
    (withholdingRatePercent, incomeTaxWon, localIncomeTaxWon) => {
      expect(
        calculateIncomeTaxes(
          {
            taxableMonthlyPayWon: 3_500_000,
            dependentsIncludingSelf: 4,
            childrenAges8To20: 2,
            withholdingRatePercent,
          },
          payrollPolicy2026H2,
        ),
      ).toEqual({ incomeTaxWon, localIncomeTaxWon });
    },
  );

  it('표 시작 전 급여의 원천징수세액은 0원이다', () => {
    expect(
      calculateIncomeTaxes(
        {
          taxableMonthlyPayWon: 769_999,
          dependentsIncludingSelf: 1,
          childrenAges8To20: 0,
          withholdingRatePercent: 100,
        },
        payrollPolicy2026H2,
      ),
    ).toEqual({ incomeTaxWon: 0, localIncomeTaxWon: 0 });
  });

  it.each([
    [10_000_000, 1_507_400],
    [14_000_000, 2_904_400],
    [28_000_000, 8_118_000],
    [30_000_000, 8_902_000],
    [45_000_000, 14_902_000],
    [87_000_000, 32_542_000],
    [100_000_000, 38_392_000],
  ])('고액 급여 %i원의 공식 경계 산식을 적용한다', (pay, expected) => {
    expect(
      calculateIncomeTaxes(
        {
          taxableMonthlyPayWon: pay,
          dependentsIncludingSelf: 1,
          childrenAges8To20: 0,
          withholdingRatePercent: 100,
        },
        payrollPolicy2026H2,
      ).incomeTaxWon,
    ).toBe(expected);
  });

  it.each([14_000_000, 28_000_000, 30_000_000, 45_000_000, 87_000_000])(
    '고액 급여 %i원 경계 전후에서 세액이 역전되지 않는다',
    (boundaryWon) => {
      const getIncomeTax = (taxableMonthlyPayWon: number) =>
        calculateIncomeTaxes(
          {
            taxableMonthlyPayWon,
            dependentsIncludingSelf: 1,
            childrenAges8To20: 0,
            withholdingRatePercent: 100,
          },
          payrollPolicy2026H2,
        ).incomeTaxWon;
      const beforeWon = getIncomeTax(boundaryWon - 1);
      const boundaryTaxWon = getIncomeTax(boundaryWon);
      const afterWon = getIncomeTax(boundaryWon + 1);

      expect(beforeWon).toBeLessThanOrEqual(boundaryTaxWon);
      expect(boundaryTaxWon).toBeLessThanOrEqual(afterWon);
      expect(boundaryTaxWon - beforeWon).toBeLessThanOrEqual(10);
      expect(afterWon - boundaryTaxWon).toBeLessThanOrEqual(10);
    },
  );
});
