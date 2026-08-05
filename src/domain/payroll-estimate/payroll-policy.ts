export type PayrollPolicySource = {
  label: string;
  url: string;
};

export type PayrollPolicy = {
  id: string;
  label: string;
  effectiveFrom: string;
  incomeTaxTableEffectiveFrom: string;
  nationalPension: {
    employeeRateNumerator: number;
    rateDenominator: number;
    standardIncomeUnitWon: number;
    minimumStandardIncomeWon: number;
    maximumStandardIncomeWon: number;
  };
  healthInsurance: {
    employeeRateNumerator: number;
    rateDenominator: number;
    minimumEmployeePremiumWon: number;
    maximumEmployeePremiumWon: number;
  };
  longTermCare: {
    healthPremiumRatioNumerator: number;
    healthPremiumRatioDenominator: number;
  };
  employmentInsurance: {
    employeeRateNumerator: number;
    rateDenominator: number;
  };
  childIncomeTaxDeduction: {
    oneChildWon: number;
    twoChildrenWon: number;
    eachChildAfterTwoWon: number;
  };
  sources: readonly PayrollPolicySource[];
};

export const payrollPolicy2026H2: PayrollPolicy = {
  id: 'kr-general-employee-2026-h2-v1',
  label: '대한민국 일반 직장근로자 · 2026년 하반기',
  effectiveFrom: '2026-07-01',
  incomeTaxTableEffectiveFrom: '2026-03-01',
  nationalPension: {
    employeeRateNumerator: 475,
    rateDenominator: 10_000,
    standardIncomeUnitWon: 1_000,
    minimumStandardIncomeWon: 410_000,
    maximumStandardIncomeWon: 6_590_000,
  },
  healthInsurance: {
    employeeRateNumerator: 3_595,
    rateDenominator: 100_000,
    minimumEmployeePremiumWon: 10_080,
    maximumEmployeePremiumWon: 4_591_740,
  },
  longTermCare: {
    healthPremiumRatioNumerator: 9_448,
    healthPremiumRatioDenominator: 71_900,
  },
  employmentInsurance: {
    employeeRateNumerator: 9,
    rateDenominator: 1_000,
  },
  childIncomeTaxDeduction: {
    oneChildWon: 20_830,
    twoChildrenWon: 45_830,
    eachChildAfterTwoWon: 33_330,
  },
  sources: [
    {
      label: '근로소득 간이세액표 · 국가법령정보센터',
      url: 'https://law.go.kr/flDownload.do?bylClsCd=110201&flSeq=163623339&gubun=',
    },
    {
      label: '국민연금 보험료율 · 국민연금공단',
      url: 'https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0095M0.do?menuId=MN24001131',
    },
    {
      label: '국민연금 기준소득월액 상·하한 · 국민연금공단',
      url: 'https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0038M0.do?menuId=MN24001113',
    },
    {
      label: '건강·장기요양보험료율 · 국민건강보험공단',
      url: 'https://edi.nhis.or.kr/portal/images/popup/20251204_pop01longdesc.html',
    },
    {
      label: '고용보험료율 · 고용노동부',
      url: 'https://moel.go.kr/info/astmgmt/employ/employList.do',
    },
  ],
};
