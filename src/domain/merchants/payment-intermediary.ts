import { normalizeMerchantName } from './merchant-normalizer';

const PAYMENT_INTERMEDIARY_KEYS = [
  'payco오더',
  '네이버페이',
  '카카오페이',
  '토스페이',
  'kg이니시스',
] as const;

export function isPaymentIntermediaryMerchant(merchantName: string): boolean {
  const comparisonKey = normalizeMerchantName(merchantName).comparisonKey;

  return PAYMENT_INTERMEDIARY_KEYS.some((intermediaryKey) =>
    comparisonKey.includes(intermediaryKey),
  );
}
