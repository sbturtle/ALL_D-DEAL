import { describe, expect, it } from 'vitest';

import { classifyAccountTransactionType } from './account-transaction-type-classifier';

describe('classifyAccountTransactionType', () => {
  it.each([
    ['카드 결제', 'OUTFLOW', 'CARD_PAYMENT', 'card_payment_keyword'],
    ['적금 자동 이체', 'OUTFLOW', 'SAVING', 'savings_keyword'],
    ['대출 이자 납부', 'OUTFLOW', 'LOAN_PAYMENT', 'loan_payment_keyword'],
    ['증권 투자', 'OUTFLOW', 'INVESTMENT', 'investment_keyword'],
    ['계좌 이체', 'OUTFLOW', 'TRANSFER', 'transfer_keyword'],
    ['급여 입금', 'INFLOW', 'INCOME', 'income_keyword'],
    ['포인트 캐시백', 'INFLOW', 'REWARD', 'reward_keyword'],
  ] as const)(
    'classifies explicit %s wording as %s',
    (descriptionOriginal, direction, type, reasonCode) => {
      expect(
        classifyAccountTransactionType({ direction, descriptionOriginal }),
      ).toEqual({
        type,
        source: 'ACCOUNT_RULE_ENGINE',
        reasonCode,
        confidence: 'HIGH',
      });
    },
  );

  it('does not infer SELF_TRANSFER without user-managed account aliases', () => {
    expect(
      classifyAccountTransactionType({
        direction: 'OUTFLOW',
        descriptionOriginal: '내 계좌 이체',
      }),
    ).toMatchObject({
      type: 'TRANSFER',
      reasonCode: 'transfer_keyword',
    });
  });

  it.each([
    ['카드 결제', 'INFLOW'],
    ['캐시백', 'OUTFLOW'],
    ['검토 대상 거래', 'INFLOW'],
  ] as const)(
    'leaves invalid-direction or unmatched wording for review: %s + %s',
    (descriptionOriginal, direction) => {
      expect(
        classifyAccountTransactionType({ direction, descriptionOriginal }),
      ).toEqual({
        type: 'UNKNOWN',
        source: 'ACCOUNT_RULE_ENGINE',
        reasonCode: 'no_matching_rule',
        confidence: 'REVIEW',
      });
    },
  );
});
