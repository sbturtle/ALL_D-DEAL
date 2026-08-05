import { isCalendarDate } from '../transactions/calendar-date';
import type { CalendarDate } from '../transactions/calendar-date';
import { isPositiveMinorAmount } from '../transactions/money';
import type { CurrencyCode } from '../transactions/money';
import { classifyAccountTransactionType } from '../transactions/account-transaction-type-classifier';
import type { AccountTransactionTypeClassification } from '../transactions/account-transaction-type-classifier';
import type {
  TransactionDirection,
  TransactionType,
} from '../transactions/transaction';
import type { CategoryId } from '../categories/category';

export const MAX_IMPORT_ROWS = 2_000;
export const MAX_IMPORT_COLUMNS = 20;
export const MAX_IMPORT_CELL_TEXT_LENGTH = 300;

export const IMPORT_SOURCES = [
  'ACCOUNT_LEDGER_XLS',
  'CARD_USAGE_XLS',
] as const;

export type ImportSource = (typeof IMPORT_SOURCES)[number];

export type TransactionDraft = Readonly<{
  occurredOn: CalendarDate;
  amountMinor: number;
  currency: CurrencyCode;
  direction: TransactionDirection;
  type: TransactionType;
  categoryId?: CategoryId;
  descriptionOriginal: string;
  paymentInstrumentLabel?: string;
}>;

export type ImportCandidate = Readonly<{
  source: ImportSource;
  rowNumber: number;
  draft: TransactionDraft;
  accountTypeClassification?: AccountTransactionTypeClassification;
}>;

export type ImportIssueCode =
  | 'unsupported_file'
  | 'unsupported_layout'
  | 'invalid_date'
  | 'invalid_amount'
  | 'reversal_requires_review'
  | 'foreign_currency_requires_review'
  | 'invalid_text';

export type ImportIssue = Readonly<{
  source?: ImportSource;
  rowNumber?: number;
  code: ImportIssueCode;
  message: string;
}>;

export type ImportPreview = Readonly<{
  source?: ImportSource;
  candidates: readonly ImportCandidate[];
  issues: readonly ImportIssue[];
}>;

export type LegacyXlsRows = readonly (readonly unknown[])[];

const DATE_HEADER_PATTERN = /거래일|이용일|승인일|날짜|일자/i;
const TIME_HEADER_PATTERN = /시간|시각/i;
const DESCRIPTION_HEADER_PATTERN = /적요|거래내용|내용|상대방/i;
const WITHDRAWAL_HEADER_PATTERN = /찾으신|출금/i;
const DEPOSIT_HEADER_PATTERN = /맡기신|입금/i;
const CARD_HEADER_PATTERN = /카드/i;
const AMOUNT_HEADER_PATTERN = /금액/i;

function createPreview(
  source: ImportSource | undefined,
  candidates: readonly ImportCandidate[],
  issues: readonly ImportIssue[],
): ImportPreview {
  return { source, candidates, issues };
}

function hasHeaderText(value: unknown, pattern: RegExp): boolean {
  return typeof value === 'string' && pattern.test(value);
}

function isEmptyRow(row: readonly unknown[]): boolean {
  return row.every(
    (value) => value === null || value === undefined || String(value).trim() === '',
  );
}

function findHeaderRow(
  rows: LegacyXlsRows,
  isHeader: (row: readonly unknown[]) => boolean,
): number | null {
  const headerSearchLimit = Math.min(rows.length, 10);

  for (let index = 0; index < headerSearchLimit; index += 1) {
    if (isHeader(rows[index] ?? [])) {
      return index;
    }
  }

  return null;
}

function parseCalendarDate(value: unknown): CalendarDate | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(
    value.trim(),
  );

  if (!match) {
    return null;
  }

  const normalized = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;

  return isCalendarDate(normalized) ? normalized : null;
}

function parseNonNegativeFiniteAmount(value: unknown): number | null {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value.replaceAll(',', '').trim())
        : Number.NaN;

  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : null;
}

function readDescription(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim().length > 0 && value.length <= MAX_IMPORT_CELL_TEXT_LENGTH
    ? value
    : null;
}

function createIssue(
  source: ImportSource,
  rowNumber: number | undefined,
  code: ImportIssueCode,
  message: string,
): ImportIssue {
  return {
    source,
    ...(rowNumber === undefined ? {} : { rowNumber }),
    code,
    message,
  };
}

function createAccountLedgerPreview(rows: LegacyXlsRows): ImportPreview | null {
  const headerRow = findHeaderRow(
    rows,
    (row) =>
      row.length >= 6 &&
      hasHeaderText(row[0], DATE_HEADER_PATTERN) &&
      hasHeaderText(row[1], DESCRIPTION_HEADER_PATTERN) &&
      hasHeaderText(row[4], WITHDRAWAL_HEADER_PATTERN) &&
      hasHeaderText(row[5], DEPOSIT_HEADER_PATTERN),
  );

  if (headerRow === null) {
    return null;
  }

  const source: ImportSource = 'ACCOUNT_LEDGER_XLS';
  const candidates: ImportCandidate[] = [];
  const issues: ImportIssue[] = [];

  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];

    if (isEmptyRow(row)) {
      continue;
    }

    const rowNumber = index + 1;
    const occurredOn = parseCalendarDate(row[0]);
    const descriptionOriginal = readDescription(row[1]);
    const withdrawalAmount = parseNonNegativeFiniteAmount(row[4]);
    const depositAmount = parseNonNegativeFiniteAmount(row[5]);

    if (occurredOn === null) {
      issues.push(
        createIssue(source, rowNumber, 'invalid_date', '거래일을 확인해 주세요.'),
      );
    }

    if (descriptionOriginal === null) {
      issues.push(
        createIssue(source, rowNumber, 'invalid_text', '거래 설명을 확인해 주세요.'),
      );
    }

    const hasValidAmounts =
      withdrawalAmount !== null && depositAmount !== null;
    const isWithdrawal = hasValidAmounts && withdrawalAmount > 0 && depositAmount === 0;
    const isDeposit = hasValidAmounts && withdrawalAmount === 0 && depositAmount > 0;

    if (!isWithdrawal && !isDeposit) {
      issues.push(
        createIssue(
          source,
          rowNumber,
          'invalid_amount',
          '입금 또는 출금 금액을 하나만 확인할 수 있어야 합니다.',
        ),
      );
    }

    if (occurredOn === null || descriptionOriginal === null || (!isWithdrawal && !isDeposit)) {
      continue;
    }

    const amountMinor = isWithdrawal ? withdrawalAmount : depositAmount;

    if (!isPositiveMinorAmount(amountMinor)) {
      issues.push(
        createIssue(
          source,
          rowNumber,
          'invalid_amount',
          '거래 금액은 양의 원 단위 정수여야 합니다.',
        ),
      );
      continue;
    }

    const direction = isWithdrawal ? 'OUTFLOW' : 'INFLOW';
    const accountTypeClassification = classifyAccountTransactionType({
      direction,
      descriptionOriginal,
    });

    candidates.push({
      source,
      rowNumber,
      accountTypeClassification,
      draft: {
        occurredOn,
        amountMinor,
        currency: 'KRW',
        direction,
        type: accountTypeClassification.type,
        descriptionOriginal,
      },
    });
  }

  return createPreview(source, candidates, issues);
}

function isCardReversal(value: unknown): boolean {
  return typeof value === 'string' && /취소/.test(value);
}

function toSafeCardLabel(value: unknown): string {
  const digits = typeof value === 'string' ? value.replaceAll(/[^0-9]/g, '') : '';

  return digits.length >= 4 ? `카드 ••••${digits.slice(-4)}` : '카드';
}

function createCardUsagePreview(rows: LegacyXlsRows): ImportPreview | null {
  const headerRow = findHeaderRow(
    rows,
    (row) =>
      row.length >= 14 &&
      hasHeaderText(row[0], DATE_HEADER_PATTERN) &&
      hasHeaderText(row[1], TIME_HEADER_PATTERN) &&
      hasHeaderText(row[3], CARD_HEADER_PATTERN) &&
      hasHeaderText(row[5], AMOUNT_HEADER_PATTERN) &&
      hasHeaderText(row[6], AMOUNT_HEADER_PATTERN),
  );

  if (headerRow === null) {
    return null;
  }

  const source: ImportSource = 'CARD_USAGE_XLS';
  const candidates: ImportCandidate[] = [];
  const issues: ImportIssue[] = [];

  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];

    if (isEmptyRow(row)) {
      continue;
    }

    const rowNumber = index + 1;
    const occurredOn = parseCalendarDate(row[0]);
    const descriptionOriginal = readDescription(row[4]);
    const krwAmount = parseNonNegativeFiniteAmount(row[5]);
    const foreignAmount = parseNonNegativeFiniteAmount(row[6]);
    const isReversal = isCardReversal(row[11]);

    if (occurredOn === null) {
      issues.push(
        createIssue(source, rowNumber, 'invalid_date', '거래일을 확인해 주세요.'),
      );
    }

    if (descriptionOriginal === null) {
      issues.push(
        createIssue(source, rowNumber, 'invalid_text', '이용처를 확인해 주세요.'),
      );
    }

    if (isReversal) {
      issues.push(
        createIssue(
          source,
          rowNumber,
          'reversal_requires_review',
          '취소 또는 역분개 거래는 자동 반영하지 않습니다.',
        ),
      );
    }

    const hasForeignAmount = foreignAmount !== null && foreignAmount > 0;

    if (hasForeignAmount) {
      issues.push(
        createIssue(
          source,
          rowNumber,
          'foreign_currency_requires_review',
          '외화 금액 거래는 자동 반영하지 않습니다.',
        ),
      );
    }

    const hasValidKrwAmount = isPositiveMinorAmount(krwAmount);

    if (foreignAmount === null || !hasValidKrwAmount) {
      issues.push(
        createIssue(
          source,
          rowNumber,
          'invalid_amount',
          '원화 이용 금액을 확인해 주세요.',
        ),
      );
    }

    if (
      occurredOn === null ||
      descriptionOriginal === null ||
      isReversal ||
      hasForeignAmount ||
      !hasValidKrwAmount ||
      foreignAmount === null
    ) {
      continue;
    }

    candidates.push({
      source,
      rowNumber,
      draft: {
        occurredOn,
        amountMinor: krwAmount,
        currency: 'KRW',
        direction: 'OUTFLOW',
        type: 'EXPENSE',
        descriptionOriginal,
        paymentInstrumentLabel: toSafeCardLabel(row[3]),
      },
    });
  }

  return createPreview(source, candidates, issues);
}

export function previewLegacyXlsRows(rows: LegacyXlsRows): ImportPreview {
  const accountLedgerPreview = createAccountLedgerPreview(rows);

  if (accountLedgerPreview !== null) {
    return accountLedgerPreview;
  }

  const cardUsagePreview = createCardUsagePreview(rows);

  if (cardUsagePreview !== null) {
    return cardUsagePreview;
  }

  return createPreview(undefined, [], [
    {
      code: 'unsupported_layout',
      message: '지원하는 계좌 거래 또는 카드 이용 XLS 레이아웃이 아닙니다.',
    },
  ]);
}
