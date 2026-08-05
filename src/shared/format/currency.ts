const wonFormatter = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 0,
});

export function formatWon(amountWon: number): string {
  return `${wonFormatter.format(amountWon)}원`;
}

export function formatWonInput(digits: string): string {
  if (digits === '') {
    return '';
  }

  const amountWon = Number(digits);

  if (!Number.isSafeInteger(amountWon)) {
    return digits;
  }

  return wonFormatter.format(amountWon);
}

export function sanitizeWonInput(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (digits === '') {
    return '';
  }

  return digits.replace(/^0+(?=\d)/, '');
}

export function parseWonInput(digits: string): number {
  if (digits === '') {
    return 0;
  }

  return Number(digits);
}
