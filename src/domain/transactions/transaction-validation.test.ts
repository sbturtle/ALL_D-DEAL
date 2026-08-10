import { describe, expect, it } from 'vitest';

import {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_TYPES,
} from './transaction';
import { CATEGORY_IDS } from '../categories/category';
import { DEFAULT_BUDGET_BUCKETS } from '../budget-buckets/budget-bucket';
import { validateTransaction } from './transaction-validation';

const validTransaction = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  occurredOn: '2026-08-05',
  amountMinor: 45_000,
  currency: 'KRW',
  direction: 'OUTFLOW',
  type: 'EXPENSE',
  budgetBucketId: 'LIVING',
  descriptionOriginal: '명백한 가짜 식료품 예시',
  createdAt: '2026-08-05T07:30:00.000Z',
  updatedAt: '2026-08-05T07:30:00.000Z',
} as const;

function expectIssue(
  candidate: unknown,
  field: string,
  code: string,
) {
  const result = validateTransaction(candidate);

  expect(result.isValid).toBe(false);

  if (!result.isValid) {
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ field, code })]),
    );
  }
}

describe('validateTransaction', () => {
  it('최소 Transaction을 허용 필드만 가진 새 객체로 반환한다', () => {
    const result = validateTransaction(validTransaction);

    expect(result).toEqual({ isValid: true, value: validTransaction });

    if (result.isValid) {
      expect(result.value).not.toBe(validTransaction);
    }
  });

  it('모든 선택 문자열을 원문 그대로 보존한다', () => {
    const candidate = {
      ...validTransaction,
      descriptionOriginal: '  가짜 원문 설명  ',
      merchantOriginal: '  예시 상점 원문  ',
      merchantNormalized: '예시 상점',
      paymentInstrumentLabel: '테스트 카드 끝 1234',
      memo: '  사용자 예시 메모  ',
    };
    const result = validateTransaction(candidate);

    expect(result).toEqual({ isValid: true, value: candidate });
  });

  it('Import 출처는 batch와 importer를 함께 보존한다', () => {
    const candidate = {
      ...validTransaction,
      importBatchId: '550e8400-e29b-41d4-a716-446655440001',
      importerId: 'LEGACY_XLS',
    } as const;

    expect(validateTransaction(candidate)).toEqual({
      isValid: true,
      value: candidate,
    });
  });

  it('Import 출처의 한쪽만 있으면 거절한다', () => {
    expectIssue(
      {
        ...validTransaction,
        importBatchId: '550e8400-e29b-41d4-a716-446655440001',
      },
      'importerId',
      'required',
    );
  });

  it.each(TRANSACTION_TYPES)('%s 유형을 허용한다', (type) => {
    expect(validateTransaction({ ...validTransaction, type }).isValid).toBe(
      true,
    );
  });

  it.each(TRANSACTION_DIRECTIONS)('%s 방향을 허용한다', (direction) => {
    expect(
      validateTransaction({ ...validTransaction, direction }).isValid,
    ).toBe(true);
  });

  it.each([
    ['TRANSFER', 'INFLOW'],
    ['TRANSFER', 'OUTFLOW'],
    ['CARD_PAYMENT', 'INFLOW'],
    ['REFUND', 'INFLOW'],
    ['UNKNOWN', 'OUTFLOW'],
    ['EXPENSE', 'INFLOW'],
    ['INCOME', 'OUTFLOW'],
  ])('샘플 없이 %s + %s 조합을 금지하지 않는다', (type, direction) => {
    expect(
      validateTransaction({ ...validTransaction, type, direction }).isValid,
    ).toBe(true);
  });

  it.each([
    'id',
    'occurredOn',
    'amountMinor',
    'currency',
    'direction',
    'type',
    'budgetBucketId',
    'descriptionOriginal',
    'createdAt',
    'updatedAt',
  ])('%s 필드가 없으면 required issue를 반환한다', (field) => {
    const candidate = Object.fromEntries(
      Object.entries(validTransaction).filter(([key]) => key !== field),
    );

    expectIssue(candidate, field, 'required');
  });

  it.each([
    null,
    undefined,
    [],
    'transaction',
    410,
    new Date('2026-08-05T00:00:00Z'),
    new Map(),
    /transaction/,
  ])(
    '일반 데이터 객체가 아닌 %j를 root issue로 거부한다',
    (candidate) => {
      expectIssue(candidate, '$root', 'invalid_root');
    },
  );

  it.each([
    0,
    -0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    '45000',
  ])('%j 금액을 거부한다', (amountMinor) => {
    expectIssue(
      { ...validTransaction, amountMinor },
      'amountMinor',
      'invalid_amount',
    );
  });

  it.each(['USD', 'krw', '', null])('%j 통화를 거부한다', (currency) => {
    expectIssue(
      { ...validTransaction, currency },
      'currency',
      'unsupported_currency',
    );
  });

  it.each(['IN', 'outflow', '', null])('%j 방향을 거부한다', (direction) => {
    expectIssue(
      { ...validTransaction, direction },
      'direction',
      'unsupported_direction',
    );
  });

  it.each(['PAYMENT', 'expense', '', null])('%j 유형을 거부한다', (type) => {
    expectIssue(
      { ...validTransaction, type },
      'type',
      'unsupported_type',
    );
  });

  it.each([
    '',
    '550e8400e29b41d4a716446655440000',
    '00000000-0000-0000-0000-000000000000',
    'not-a-uuid',
    null,
  ])('%j ID를 거부한다', (id) => {
    expectIssue({ ...validTransaction, id }, 'id', 'invalid_uuid');
  });

  it('대문자 canonical UUID를 허용한다', () => {
    const result = validateTransaction({
      ...validTransaction,
      id: validTransaction.id.toUpperCase(),
    });

    expect(result.isValid).toBe(true);
  });

  it.each(['2025-02-29', '2026-04-31', '2026-8-05', null])(
    '%j 거래일을 거부한다',
    (occurredOn) => {
      expectIssue(
        { ...validTransaction, occurredOn },
        'occurredOn',
        'invalid_calendar_date',
      );
    },
  );

  it.each([
    ['createdAt', '2025-02-29T00:00:00Z'],
    ['createdAt', '2026-08-05T16:30:00+09:00'],
    ['updatedAt', '2026-08-05T07:30:00.1234Z'],
    ['updatedAt', null],
  ])('%s의 %j 값을 거부한다', (field, value) => {
    expectIssue(
      { ...validTransaction, [field]: value },
      field,
      'invalid_utc_instant',
    );
  });

  it('수정 시각이 생성 시각보다 빠르면 거부한다', () => {
    expectIssue(
      {
        ...validTransaction,
        updatedAt: '2026-08-05T07:29:59.999Z',
      },
      'updatedAt',
      'invalid_timestamp_order',
    );
  });

  it.each([
    ['descriptionOriginal', '   '],
    ['descriptionOriginal', null],
    ['merchantOriginal', ''],
    ['merchantNormalized', '   '],
    ['paymentInstrumentLabel', 410],
    ['memo', null],
  ])('%s의 %j 값을 빈 문자열 issue로 거부한다', (field, value) => {
    expectIssue(
      { ...validTransaction, [field]: value },
      field,
      'invalid_text',
    );
  });

  it.each([
    '4111111111111111',
    '4111-1111-1111-1111',
    '123-456-789012',
    '테스트 카드 12345',
  ])('전체 금융 식별자로 보이는 결제수단 라벨을 거부한다', (value) => {
    expectIssue(
      { ...validTransaction, paymentInstrumentLabel: value },
      'paymentInstrumentLabel',
      'sensitive_financial_identifier',
    );
  });

  it.each(['현금', '테스트 카드 A', '끝 1234', '예시 계좌 42'])(
    '민감하지 않은 결제수단 라벨 %s를 허용한다',
    (paymentInstrumentLabel) => {
      expect(
        validateTransaction({ ...validTransaction, paymentInstrumentLabel })
          .isValid,
      ).toBe(true);
    },
  );

  it('명시적인 undefined 선택 필드는 생략된 값으로 처리한다', () => {
    const result = validateTransaction({ ...validTransaction, memo: undefined });

    expect(result).toEqual({ isValid: true, value: validTransaction });
  });

  it('지원하지 않는 추가 필드를 조용히 저장하지 않는다', () => {
    expectIssue(
      { ...validTransaction, sourceRow: '저장하지 않을 가짜 원본' },
      '$root',
      'unexpected_field',
    );
  });

  it('여러 오류를 누적하되 issue에 후보 원문 값과 추가 필드명을 포함하지 않는다', () => {
    const sensitiveLikeValue = 'candidate-value-must-not-appear';
    const result = validateTransaction({
      ...validTransaction,
      id: sensitiveLikeValue,
      amountMinor: 0,
      descriptionOriginal: '   ',
      [sensitiveLikeValue]: sensitiveLikeValue,
    });

    expect(result.isValid).toBe(false);

    if (!result.isValid) {
      expect(result.issues.map((issue) => issue.field)).toEqual(
        expect.arrayContaining([
          'id',
          'amountMinor',
          'descriptionOriginal',
          '$root',
        ]),
      );
      expect(JSON.stringify(result.issues)).not.toContain(sensitiveLikeValue);
    }
  });

  it.each(CATEGORY_IDS)('%s 카테고리를 선택 값으로 허용한다', (categoryId) => {
    expect(
      validateTransaction({ ...validTransaction, categoryId }).isValid,
    ).toBe(true);
  });

  it.each(DEFAULT_BUDGET_BUCKETS)(
    '$name 자금통을 필수 선택 값으로 허용한다',
    ({ id: budgetBucketId }) => {
      expect(
        validateTransaction({ ...validTransaction, budgetBucketId }).isValid,
      ).toBe(true);
    },
  );

  it('미래 사용자 자금통 ID를 허용한다', () => {
    expect(
      validateTransaction({
        ...validTransaction,
        budgetBucketId: 'travel-2026',
      }).isValid,
    ).toBe(true);
  });

  it('빈 자금통 ID를 거절한다', () => {
    expectIssue(
      { ...validTransaction, budgetBucketId: ' ' },
      'budgetBucketId',
      'unsupported_type',
    );
  });

  it('지원하지 않는 카테고리를 거절한다', () => {
    expectIssue(
      { ...validTransaction, categoryId: 'UNCLASSIFIED' },
      'categoryId',
      'unsupported_type',
    );
  });
});
