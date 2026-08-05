export type DashboardSummaryItem = {
  label: string;
  valueWon: number;
  detail: string;
  tone: 'income' | 'expense' | 'saving';
};

export type DashboardMockTransaction = {
  id: string;
  description: string;
  category: string;
  amountWon: number;
  direction: 'IN' | 'OUT';
};

export const dashboardMockSummary: readonly DashboardSummaryItem[] = [
  {
    label: '이번 달 수입',
    valueWon: 3_420_000,
    detail: '예시 거래 2건',
    tone: 'income',
  },
  {
    label: '생활비 사용',
    valueWon: 1_230_000,
    detail: '가짜 목표 1,800,000원',
    tone: 'expense',
  },
  {
    label: '저축',
    valueWon: 820_000,
    detail: '예시 저축 거래',
    tone: 'saving',
  },
];

export const dashboardMockTransactions: readonly DashboardMockTransaction[] = [
  {
    id: 'mock-transaction-1',
    description: '예시 급여',
    category: '수입 · Mock',
    amountWon: 3_200_000,
    direction: 'IN',
  },
  {
    id: 'mock-transaction-2',
    description: '동네 마트 예시',
    category: '식비 · Mock',
    amountWon: 84_500,
    direction: 'OUT',
  },
  {
    id: 'mock-transaction-3',
    description: '정기 저축 예시',
    category: '저축 · Mock',
    amountWon: 500_000,
    direction: 'OUT',
  },
];
