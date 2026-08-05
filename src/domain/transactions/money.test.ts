import { describe, expect, it } from 'vitest';

import { isPositiveMinorAmount, isSupportedCurrency } from './money';

describe('isPositiveMinorAmount', () => {
  it.each([1, 10_000, Number.MAX_SAFE_INTEGER])(
    '%d원을 양의 safe integer 금액으로 허용한다',
    (value) => {
      expect(isPositiveMinorAmount(value)).toBe(true);
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
    '1000',
    null,
  ])('%j를 Transaction 금액으로 거부한다', (value) => {
    expect(isPositiveMinorAmount(value)).toBe(false);
  });
});

describe('isSupportedCurrency', () => {
  it('현재 통화인 KRW를 허용한다', () => {
    expect(isSupportedCurrency('KRW')).toBe(true);
  });

  it.each(['krw', 'USD', '', null, 410])('지원하지 않는 %j를 거부한다', (value) => {
    expect(isSupportedCurrency(value)).toBe(false);
  });
});
