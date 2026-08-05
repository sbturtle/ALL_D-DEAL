import { describe, expect, it } from 'vitest';

import {
  previewLegacyXlsRows,
  type LegacyXlsRows,
} from './legacy-xls-preview';

const accountLedgerRows: LegacyXlsRows = [
  ['가짜 계좌 거래내역'],
  [],
  [],
  [
    '거래일시',
    '적요',
    '거래 지점',
    '참고',
    '찾으신금액',
    '맡기신금액',
    '잔액',
  ],
  ['2026.08.01 10:30', '가짜 카드 결제', '가짜 지점', '', 15_000, 0, 985_000],
  ['2026.08.02', '가짜 급여', '가짜 지점', '', 0, 2_000_000, 2_985_000],
  ['2026.08.03', '모호한 금액', '가짜 지점', '', 1, 1, 2_985_000],
  ['날짜 오류', '가짜 거래', '가짜 지점', '', 0, 50_000, 3_035_000],
] as const;

const cardUsageRows: LegacyXlsRows = [
  ['가짜 카드 이용내역'],
  [],
  [],
  [],
  [
    '승인일자',
    '승인시간',
    '구분',
    '카드번호',
    '이용처',
    '원화이용금액',
    '외화이용금액',
    '할부구분',
    '참고',
    '코드1',
    '코드2',
    '처리상태',
    '매입일자',
    '승인번호',
  ],
  [
    '2026-08-01',
    '10:05',
    '개인',
    '9999-8888-7777-1234',
    '가짜 서점',
    23_000,
    0,
    '일시불',
    '',
    1,
    2,
    '매입',
    '2026-08-02',
    '12345678',
  ],
  [
    '2026-08-02',
    '11:15',
    '개인',
    '9999-8888-7777-1234',
    '가짜 취소',
    12_000,
    0,
    '일시불',
    '',
    1,
    2,
    '매입취소',
    '2026-08-03',
    '12345679',
  ],
  [
    '2026-08-03',
    '12:25',
    '개인',
    '9999-8888-7777-1234',
    '가짜 해외 거래',
    0,
    19.99,
    '일시불',
    '',
    1,
    2,
    '매입',
    '2026-08-04',
    '12345680',
  ],
] as const;

describe('previewLegacyXlsRows', () => {
  it('계좌 출금·입금 중 하나가 있는 행만 방향을 가진 UNKNOWN 후보로 만든다', () => {
    const preview = previewLegacyXlsRows(accountLedgerRows);

    expect(preview.source).toBe('ACCOUNT_LEDGER_XLS');
    expect(preview.candidates).toEqual([
      {
        source: 'ACCOUNT_LEDGER_XLS',
        rowNumber: 5,
        accountTypeClassification: {
          type: 'CARD_PAYMENT',
          source: 'ACCOUNT_RULE_ENGINE',
          reasonCode: 'card_payment_keyword',
          confidence: 'HIGH',
        },
        draft: {
          occurredOn: '2026-08-01',
          amountMinor: 15_000,
          currency: 'KRW',
          direction: 'OUTFLOW',
          type: 'CARD_PAYMENT',
          descriptionOriginal: '가짜 카드 결제',
        },
      },
      {
        source: 'ACCOUNT_LEDGER_XLS',
        rowNumber: 6,
        accountTypeClassification: {
          type: 'INCOME',
          source: 'ACCOUNT_RULE_ENGINE',
          reasonCode: 'income_keyword',
          confidence: 'HIGH',
        },
        draft: {
          occurredOn: '2026-08-02',
          amountMinor: 2_000_000,
          currency: 'KRW',
          direction: 'INFLOW',
          type: 'INCOME',
          descriptionOriginal: '가짜 급여',
        },
      },
    ]);
    expect(preview.issues.map((issue) => issue.code)).toEqual([
      'invalid_amount',
      'invalid_date',
    ]);
  });

  it('카드 원화 매입만 EXPENSE 후보로 만들고 끝 4자리만 결제수단 라벨에 남긴다', () => {
    const preview = previewLegacyXlsRows(cardUsageRows);

    expect(preview.source).toBe('CARD_USAGE_XLS');
    expect(preview.candidates).toEqual([
      {
        source: 'CARD_USAGE_XLS',
        rowNumber: 6,
        draft: {
          occurredOn: '2026-08-01',
          amountMinor: 23_000,
          currency: 'KRW',
          direction: 'OUTFLOW',
          type: 'EXPENSE',
          descriptionOriginal: '가짜 서점',
          paymentInstrumentLabel: '카드 ••••1234',
        },
      },
    ]);
    expect(preview.issues.map((issue) => issue.code)).toEqual([
      'reversal_requires_review',
      'foreign_currency_requires_review',
      'invalid_amount',
    ]);
    expect(JSON.stringify(preview)).not.toContain('9999-8888-7777-1234');
    expect(JSON.stringify(preview)).not.toContain('9999888877771234');
  });

  it('지원하지 않는 레이아웃을 원본 헤더나 값 없이 일반 오류로 보고한다', () => {
    const preview = previewLegacyXlsRows([['비공개 헤더', '비공개 값']]);

    expect(preview).toEqual({
      source: undefined,
      candidates: [],
      issues: [
        {
          code: 'unsupported_layout',
          message: '지원하는 계좌 거래 또는 카드 이용 XLS 레이아웃이 아닙니다.',
        },
      ],
    });
    expect(JSON.stringify(preview)).not.toContain('비공개 헤더');
    expect(JSON.stringify(preview)).not.toContain('비공개 값');
  });

  it('날짜·설명·금액이 올바르지 않은 카드 행을 후보로 만들지 않는다', () => {
    const invalidRows = cardUsageRows.map((row) => [...row]);
    invalidRows[5]![0] = '2026-02-30';
    invalidRows[5]![4] = ' '.repeat(301);
    invalidRows[5]![5] = 100.5;

    const preview = previewLegacyXlsRows(invalidRows);

    expect(preview.candidates).toHaveLength(0);
    expect(preview.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['invalid_date', 'invalid_text', 'invalid_amount']),
    );
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowNumber: 6, code: 'invalid_amount' }),
      ]),
    );
  });
});
