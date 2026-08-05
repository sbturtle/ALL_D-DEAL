import {
  incomeTaxAtTenMillion2026,
  incomeTaxTable2026,
} from './income-tax-table-2026';
import { floorRatio, floorToUnit } from './money';
import type { PayrollPolicy } from './payroll-policy';

export type WithholdingRatePercent = 80 | 100 | 120;

export type IncomeTaxInput = {
  taxableMonthlyPayWon: number;
  dependentsIncludingSelf: number;
  childrenAges8To20: number;
  withholdingRatePercent: WithholdingRatePercent;
};

export type IncomeTaxResult = {
  incomeTaxWon: number;
  localIncomeTaxWon: number;
};

const TEN_MILLION_WON = 10_000_000;

function findTableTax(
  taxableMonthlyPayWon: number,
  dependentsIncludingSelf: number,
): number {
  let start = 0;
  let end = incomeTaxTable2026.length - 1;

  while (start <= end) {
    const middle = Math.floor((start + end) / 2);
    const row = incomeTaxTable2026[middle];

    if (!row) {
      return 0;
    }

    if (taxableMonthlyPayWon < row[0]) {
      end = middle - 1;
      continue;
    }

    if (taxableMonthlyPayWon >= row[1]) {
      start = middle + 1;
      continue;
    }

    return row[dependentsIncludingSelf + 1] ?? 0;
  }

  return 0;
}

function calculateHighIncomeTax(
  taxableMonthlyPayWon: number,
  dependentsIncludingSelf: number,
): number {
  const baseTaxWon =
    incomeTaxAtTenMillion2026[dependentsIncludingSelf - 1] ?? 0;

  if (taxableMonthlyPayWon <= 14_000_000) {
    return (
      baseTaxWon +
      25_000 +
      floorRatio(taxableMonthlyPayWon - TEN_MILLION_WON, 98 * 35, 10_000)
    );
  }

  if (taxableMonthlyPayWon <= 28_000_000) {
    return (
      baseTaxWon +
      1_397_000 +
      floorRatio(taxableMonthlyPayWon - 14_000_000, 98 * 38, 10_000)
    );
  }

  if (taxableMonthlyPayWon <= 30_000_000) {
    return (
      baseTaxWon +
      6_610_600 +
      floorRatio(taxableMonthlyPayWon - 28_000_000, 98 * 40, 10_000)
    );
  }

  if (taxableMonthlyPayWon <= 45_000_000) {
    return (
      baseTaxWon +
      7_394_600 +
      floorRatio(taxableMonthlyPayWon - 30_000_000, 40, 100)
    );
  }

  if (taxableMonthlyPayWon <= 87_000_000) {
    return (
      baseTaxWon +
      13_394_600 +
      floorRatio(taxableMonthlyPayWon - 45_000_000, 42, 100)
    );
  }

  return (
    baseTaxWon +
    31_034_600 +
    floorRatio(taxableMonthlyPayWon - 87_000_000, 45, 100)
  );
}

function calculateChildDeduction(
  childrenAges8To20: number,
  policy: PayrollPolicy,
): number {
  if (childrenAges8To20 === 0) {
    return 0;
  }

  if (childrenAges8To20 === 1) {
    return policy.childIncomeTaxDeduction.oneChildWon;
  }

  return (
    policy.childIncomeTaxDeduction.twoChildrenWon +
    Math.max(childrenAges8To20 - 2, 0) *
      policy.childIncomeTaxDeduction.eachChildAfterTwoWon
  );
}

export function calculateIncomeTaxes(
  input: IncomeTaxInput,
  policy: PayrollPolicy,
): IncomeTaxResult {
  const tableTaxWon =
    input.taxableMonthlyPayWon < TEN_MILLION_WON
      ? findTableTax(
          input.taxableMonthlyPayWon,
          input.dependentsIncludingSelf,
        )
      : input.taxableMonthlyPayWon === TEN_MILLION_WON
        ? (incomeTaxAtTenMillion2026[
            input.dependentsIncludingSelf - 1
          ] ?? 0)
        : calculateHighIncomeTax(
            input.taxableMonthlyPayWon,
            input.dependentsIncludingSelf,
          );

  const afterChildDeductionWon = Math.max(
    tableTaxWon - calculateChildDeduction(input.childrenAges8To20, policy),
    0,
  );
  const adjustedIncomeTaxWon = floorToUnit(
    floorRatio(
      afterChildDeductionWon,
      input.withholdingRatePercent,
      100,
    ),
    10,
  );
  const localIncomeTaxWon = floorToUnit(
    floorRatio(adjustedIncomeTaxWon, 10, 100),
    10,
  );

  return {
    incomeTaxWon: adjustedIncomeTaxWon,
    localIncomeTaxWon,
  };
}
