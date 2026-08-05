import { describe, expect, it } from 'vitest';

import { isLivingExpense } from './living-expense';
import {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_TYPES,
} from './transaction';

const livingExpenseCases = TRANSACTION_TYPES.flatMap((type) =>
  TRANSACTION_DIRECTIONS.map((direction) => ({
    type,
    direction,
    expected: type === 'EXPENSE' && direction === 'OUTFLOW',
  })),
);

describe('isLivingExpense', () => {
  it.each(livingExpenseCases)(
    '$type + $direction의 생활비 포함 여부를 $expected로 판정한다',
    ({ type, direction, expected }) => {
      expect(isLivingExpense({ type, direction })).toBe(expected);
    },
  );

  it('카드대금 납부를 생활비로 다시 집계하지 않는다', () => {
    expect(
      isLivingExpense({ type: 'CARD_PAYMENT', direction: 'OUTFLOW' }),
    ).toBe(false);
  });

  it.each(TRANSACTION_DIRECTIONS)(
    '%s 이체를 생활비로 집계하지 않는다',
    (direction) => {
      expect(isLivingExpense({ type: 'TRANSFER', direction })).toBe(false);
    },
  );

  it('유출 방향만으로 생활비라고 판단하지 않는다', () => {
    expect(isLivingExpense({ type: 'SAVING', direction: 'OUTFLOW' })).toBe(
      false,
    );
  });
});
