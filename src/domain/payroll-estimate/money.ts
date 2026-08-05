export function floorToUnit(amountWon: number, unitWon: number): number {
  return Math.floor(amountWon / unitWon) * unitWon;
}

export function floorRatio(
  amountWon: number,
  numerator: number,
  denominator: number,
): number {
  const result =
    (BigInt(amountWon) * BigInt(numerator)) / BigInt(denominator);
  const resultWon = Number(result);

  if (!Number.isSafeInteger(resultWon)) {
    throw new RangeError('계산 결과가 안전한 정수 범위를 벗어났습니다.');
  }

  return resultWon;
}

export function sumSafeIntegers(values: readonly number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);

  if (!Number.isSafeInteger(total)) {
    throw new RangeError('금액 합계가 안전한 정수 범위를 벗어났습니다.');
  }

  return total;
}
