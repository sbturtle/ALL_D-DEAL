import type {
  TransactionDirection,
  TransactionType,
} from './transaction';

export const ACCOUNT_TRANSACTION_TYPE_CLASSIFICATION_REASON_CODES = [
  'card_payment_keyword',
  'savings_keyword',
  'loan_payment_keyword',
  'investment_keyword',
  'transfer_keyword',
  'income_keyword',
  'reward_keyword',
  'no_matching_rule',
] as const;

export type AccountTransactionTypeClassificationReasonCode =
  (typeof ACCOUNT_TRANSACTION_TYPE_CLASSIFICATION_REASON_CODES)[number];

export type AccountTransactionTypeClassification = Readonly<{
  type: TransactionType;
  source: 'ACCOUNT_RULE_ENGINE';
  reasonCode: AccountTransactionTypeClassificationReasonCode;
  confidence: 'HIGH' | 'REVIEW';
}>;

export type AccountTransactionTypeClassificationInput = Readonly<{
  direction: TransactionDirection;
  descriptionOriginal: string;
}>;

function normalizeForExplicitKeywordMatch(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replaceAll(/[\s\p{P}\p{S}_]+/gu, '');
}

function containsOneOf(
  normalizedDescription: string,
  keywords: readonly string[],
): boolean {
  return keywords.some((keyword) => normalizedDescription.includes(keyword));
}

function highConfidence(
  type: TransactionType,
  reasonCode: Exclude<
    AccountTransactionTypeClassificationReasonCode,
    'no_matching_rule'
  >,
): AccountTransactionTypeClassification {
  return {
    type,
    source: 'ACCOUNT_RULE_ENGINE',
    reasonCode,
    confidence: 'HIGH',
  };
}

function needsReview(): AccountTransactionTypeClassification {
  return {
    type: 'UNKNOWN',
    source: 'ACCOUNT_RULE_ENGINE',
    reasonCode: 'no_matching_rule',
    confidence: 'REVIEW',
  };
}

function classifyOutflow(
  normalizedDescription: string,
): AccountTransactionTypeClassification {
  if (containsOneOf(normalizedDescription, ['카드결제', '카드대금'])) {
    return highConfidence('CARD_PAYMENT', 'card_payment_keyword');
  }

  if (
    containsOneOf(normalizedDescription, [
      '대출상환',
      '대출이자',
      '원리금',
      '대출납입',
    ])
  ) {
    return highConfidence('LOAN_PAYMENT', 'loan_payment_keyword');
  }

  if (containsOneOf(normalizedDescription, ['적금', '저축', '청약'])) {
    return highConfidence('SAVING', 'savings_keyword');
  }

  if (containsOneOf(normalizedDescription, ['증권', '투자', '주식', '펀드'])) {
    return highConfidence('INVESTMENT', 'investment_keyword');
  }

  if (containsOneOf(normalizedDescription, ['계좌이체', '이체'])) {
    return highConfidence('TRANSFER', 'transfer_keyword');
  }

  return needsReview();
}

function classifyInflow(
  normalizedDescription: string,
): AccountTransactionTypeClassification {
  if (containsOneOf(normalizedDescription, ['캐시백', '리워드', '포인트'])) {
    return highConfidence('REWARD', 'reward_keyword');
  }

  if (containsOneOf(normalizedDescription, ['급여', '상여', '보너스'])) {
    return highConfidence('INCOME', 'income_keyword');
  }

  if (containsOneOf(normalizedDescription, ['계좌이체', '이체'])) {
    return highConfidence('TRANSFER', 'transfer_keyword');
  }

  return needsReview();
}

export function classifyAccountTransactionType(
  input: AccountTransactionTypeClassificationInput,
): AccountTransactionTypeClassification {
  const normalizedDescription = normalizeForExplicitKeywordMatch(
    input.descriptionOriginal,
  );

  return input.direction === 'OUTFLOW'
    ? classifyOutflow(normalizedDescription)
    : classifyInflow(normalizedDescription);
}
