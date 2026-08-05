export const SUPPORTED_CURRENCIES = ['KRW'] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export type Money = {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
};

const supportedCurrencySet: ReadonlySet<unknown> = new Set(
  SUPPORTED_CURRENCIES,
);

export function isPositiveMinorAmount(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
  );
}

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return supportedCurrencySet.has(value);
}
