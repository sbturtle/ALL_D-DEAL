const PAYMENT_INTERMEDIARY_PATTERN =
  /PAYCO\s*오더|네이버\s*페이|카카오\s*페이|토스\s*페이|KG\s*이니시스/i;

export function isPaymentIntermediaryMerchant(merchantName: string): boolean {
  return PAYMENT_INTERMEDIARY_PATTERN.test(merchantName.normalize('NFKC'));
}
