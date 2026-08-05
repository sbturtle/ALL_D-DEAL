import { isCalendarDate } from './calendar-date';
import { isPositiveMinorAmount, isSupportedCurrency } from './money';
import { isCategoryId, type CategoryId } from '../categories/category';
import {
  isTransactionDirection,
  isTransactionImporterId,
  isTransactionType,
} from './transaction';
import type {
  Transaction,
  TransactionDirection,
  TransactionImporterId,
  TransactionType,
} from './transaction';
import { isUtcIsoInstant } from './utc-iso-instant';
import type { UtcIsoInstant } from './utc-iso-instant';

export type TransactionValidationIssue = {
  readonly field: string;
  readonly code:
    | 'invalid_root'
    | 'required'
    | 'invalid_uuid'
    | 'invalid_calendar_date'
    | 'invalid_amount'
    | 'unsupported_currency'
    | 'unsupported_direction'
    | 'unsupported_type'
    | 'invalid_text'
    | 'sensitive_financial_identifier'
    | 'invalid_utc_instant'
    | 'invalid_timestamp_order'
    | 'unexpected_field';
  readonly message: string;
};

export type TransactionValidationResult =
  | {
      readonly isValid: true;
      readonly value: Transaction;
    }
  | {
      readonly isValid: false;
      readonly issues: readonly TransactionValidationIssue[];
    };

const TRANSACTION_FIELDS = [
  'id',
  'occurredOn',
  'amountMinor',
  'currency',
  'direction',
  'type',
  'categoryId',
  'descriptionOriginal',
  'merchantOriginal',
  'merchantNormalized',
  'paymentInstrumentLabel',
  'memo',
  'importBatchId',
  'importerId',
  'createdAt',
  'updatedAt',
] as const;

const transactionFieldSet: ReadonlySet<string> = new Set(TRANSACTION_FIELDS);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

type CandidateRecord = Record<string, unknown>;

function isCandidateRecord(value: unknown): value is CandidateRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function hasOwnField(candidate: CandidateRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(candidate, field);
}

function addIssue(
  issues: TransactionValidationIssue[],
  field: string,
  code: TransactionValidationIssue['code'],
  message: string,
) {
  issues.push({ field, code, message });
}

function readRequiredNonBlankText(
  candidate: CandidateRecord,
  field: string,
  issues: TransactionValidationIssue[],
): string | null {
  if (!hasOwnField(candidate, field) || candidate[field] === undefined) {
    addIssue(issues, field, 'required', '필수 문자열을 입력해 주세요.');
    return null;
  }

  const value = candidate[field];

  if (typeof value !== 'string' || value.trim().length === 0) {
    addIssue(
      issues,
      field,
      'invalid_text',
      '공백이 아닌 문자열이어야 합니다.',
    );
    return null;
  }

  return value;
}

function readOptionalNonBlankText(
  candidate: CandidateRecord,
  field: string,
  issues: TransactionValidationIssue[],
): string | undefined {
  if (!hasOwnField(candidate, field) || candidate[field] === undefined) {
    return undefined;
  }

  const value = candidate[field];

  if (typeof value !== 'string' || value.trim().length === 0) {
    addIssue(
      issues,
      field,
      'invalid_text',
      '제공된 선택 값은 공백이 아닌 문자열이어야 합니다.',
    );
    return undefined;
  }

  return value;
}

function readPaymentInstrumentLabel(
  candidate: CandidateRecord,
  issues: TransactionValidationIssue[],
): string | undefined {
  const value = readOptionalNonBlankText(
    candidate,
    'paymentInstrumentLabel',
    issues,
  );

  if (value === undefined) {
    return undefined;
  }

  const digitCount = value.match(/[0-9]/g)?.length ?? 0;

  if (digitCount > 4) {
    addIssue(
      issues,
      'paymentInstrumentLabel',
      'sensitive_financial_identifier',
      '결제수단 라벨에는 별칭과 끝 4자리까지만 사용할 수 있습니다.',
    );
    return undefined;
  }

  return value;
}

function readUuid(
  candidate: CandidateRecord,
  issues: TransactionValidationIssue[],
): string | null {
  if (!hasOwnField(candidate, 'id') || candidate.id === undefined) {
    addIssue(issues, 'id', 'required', 'Transaction ID가 필요합니다.');
    return null;
  }

  const value = candidate.id;

  if (
    typeof value !== 'string' ||
    !UUID_PATTERN.test(value) ||
    value.toLowerCase() === NIL_UUID
  ) {
    addIssue(
      issues,
      'id',
      'invalid_uuid',
      'ID는 nil이 아닌 canonical UUID 문자열이어야 합니다.',
    );
    return null;
  }

  return value;
}

function readOptionalUuid(
  candidate: CandidateRecord,
  field: 'importBatchId',
  issues: TransactionValidationIssue[],
): string | undefined {
  if (!hasOwnField(candidate, field) || candidate[field] === undefined) {
    return undefined;
  }

  const value = candidate[field];
  if (
    typeof value !== 'string' ||
    !UUID_PATTERN.test(value) ||
    value.toLowerCase() === NIL_UUID
  ) {
    addIssue(issues, field, 'invalid_uuid', 'Import batch ID는 유효한 UUID여야 합니다.');
    return undefined;
  }

  return value;
}

function readOptionalImporterId(
  candidate: CandidateRecord,
  issues: TransactionValidationIssue[],
): TransactionImporterId | undefined {
  if (!hasOwnField(candidate, 'importerId') || candidate.importerId === undefined) {
    return undefined;
  }

  if (!isTransactionImporterId(candidate.importerId)) {
    addIssue(issues, 'importerId', 'unsupported_type', '지원하지 않는 Importer입니다.');
    return undefined;
  }

  return candidate.importerId;
}

function readCalendarDate(
  candidate: CandidateRecord,
  issues: TransactionValidationIssue[],
) {
  if (!hasOwnField(candidate, 'occurredOn') || candidate.occurredOn === undefined) {
    addIssue(issues, 'occurredOn', 'required', '거래일이 필요합니다.');
    return null;
  }

  if (!isCalendarDate(candidate.occurredOn)) {
    addIssue(
      issues,
      'occurredOn',
      'invalid_calendar_date',
      '거래일은 실제로 존재하는 YYYY-MM-DD 날짜여야 합니다.',
    );
    return null;
  }

  return candidate.occurredOn;
}

function readAmountMinor(
  candidate: CandidateRecord,
  issues: TransactionValidationIssue[],
): number | null {
  if (!hasOwnField(candidate, 'amountMinor') || candidate.amountMinor === undefined) {
    addIssue(issues, 'amountMinor', 'required', '거래 금액이 필요합니다.');
    return null;
  }

  if (!isPositiveMinorAmount(candidate.amountMinor)) {
    addIssue(
      issues,
      'amountMinor',
      'invalid_amount',
      '거래 금액은 0보다 큰 원 단위 safe integer여야 합니다.',
    );
    return null;
  }

  return candidate.amountMinor;
}

function readCurrency(
  candidate: CandidateRecord,
  issues: TransactionValidationIssue[],
) {
  if (!hasOwnField(candidate, 'currency') || candidate.currency === undefined) {
    addIssue(issues, 'currency', 'required', '통화 코드가 필요합니다.');
    return null;
  }

  if (!isSupportedCurrency(candidate.currency)) {
    addIssue(
      issues,
      'currency',
      'unsupported_currency',
      '현재 Transaction은 KRW만 지원합니다.',
    );
    return null;
  }

  return candidate.currency;
}

function readDirection(
  candidate: CandidateRecord,
  issues: TransactionValidationIssue[],
): TransactionDirection | null {
  if (!hasOwnField(candidate, 'direction') || candidate.direction === undefined) {
    addIssue(issues, 'direction', 'required', '거래 방향이 필요합니다.');
    return null;
  }

  if (!isTransactionDirection(candidate.direction)) {
    addIssue(
      issues,
      'direction',
      'unsupported_direction',
      '거래 방향은 INFLOW 또는 OUTFLOW여야 합니다.',
    );
    return null;
  }

  return candidate.direction;
}

function readTransactionType(
  candidate: CandidateRecord,
  issues: TransactionValidationIssue[],
): TransactionType | null {
  if (!hasOwnField(candidate, 'type') || candidate.type === undefined) {
    addIssue(issues, 'type', 'required', '거래 유형이 필요합니다.');
    return null;
  }

  if (!isTransactionType(candidate.type)) {
    addIssue(
      issues,
      'type',
      'unsupported_type',
      '지원하는 Transaction 유형을 선택해 주세요.',
    );
    return null;
  }

  return candidate.type;
}

function readOptionalCategoryId(
  candidate: CandidateRecord,
  issues: TransactionValidationIssue[],
): CategoryId | undefined {
  if (!hasOwnField(candidate, 'categoryId') || candidate.categoryId === undefined) {
    return undefined;
  }

  if (!isCategoryId(candidate.categoryId)) {
    addIssue(
      issues,
      'categoryId',
      'unsupported_type',
      '지원하지 않는 카테고리입니다.',
    );
    return undefined;
  }

  return candidate.categoryId;
}

function readUtcIsoInstant(
  candidate: CandidateRecord,
  field: 'createdAt' | 'updatedAt',
  issues: TransactionValidationIssue[],
): UtcIsoInstant | null {
  if (!hasOwnField(candidate, field) || candidate[field] === undefined) {
    addIssue(issues, field, 'required', 'UTC 생성·수정 시각이 필요합니다.');
    return null;
  }

  const value = candidate[field];

  if (!isUtcIsoInstant(value)) {
    addIssue(
      issues,
      field,
      'invalid_utc_instant',
      '시각은 Z로 끝나는 유효한 UTC ISO instant여야 합니다.',
    );
    return null;
  }

  return value;
}

function findUnexpectedFields(
  candidate: CandidateRecord,
  issues: TransactionValidationIssue[],
) {
  const hasUnexpectedField = Object.keys(candidate).some(
    (field) => !transactionFieldSet.has(field),
  );

  if (hasUnexpectedField) {
    addIssue(
      issues,
      '$root',
      'unexpected_field',
      'Transaction에서 지원하지 않는 필드가 포함되어 있습니다.',
    );
  }
}

export function validateTransaction(
  candidate: unknown,
): TransactionValidationResult {
  if (!isCandidateRecord(candidate)) {
    return {
      isValid: false,
      issues: [
        {
          field: '$root',
          code: 'invalid_root',
          message: 'Transaction 후보는 객체여야 합니다.',
        },
      ],
    };
  }

  const issues: TransactionValidationIssue[] = [];
  const id = readUuid(candidate, issues);
  const occurredOn = readCalendarDate(candidate, issues);
  const amountMinor = readAmountMinor(candidate, issues);
  const currency = readCurrency(candidate, issues);
  const direction = readDirection(candidate, issues);
  const type = readTransactionType(candidate, issues);
  const categoryId = readOptionalCategoryId(candidate, issues);
  const descriptionOriginal = readRequiredNonBlankText(
    candidate,
    'descriptionOriginal',
    issues,
  );
  const merchantOriginal = readOptionalNonBlankText(
    candidate,
    'merchantOriginal',
    issues,
  );
  const merchantNormalized = readOptionalNonBlankText(
    candidate,
    'merchantNormalized',
    issues,
  );
  const paymentInstrumentLabel = readPaymentInstrumentLabel(candidate, issues);
  const memo = readOptionalNonBlankText(candidate, 'memo', issues);
  const importBatchId = readOptionalUuid(candidate, 'importBatchId', issues);
  const importerId = readOptionalImporterId(candidate, issues);
  const createdAt = readUtcIsoInstant(candidate, 'createdAt', issues);
  const updatedAt = readUtcIsoInstant(candidate, 'updatedAt', issues);

  findUnexpectedFields(candidate, issues);

  if (importBatchId === undefined && importerId !== undefined) {
    addIssue(issues, 'importBatchId', 'required', 'Importer가 있으면 Import batch ID가 필요합니다.');
  }

  if (importBatchId !== undefined && importerId === undefined) {
    addIssue(issues, 'importerId', 'required', 'Import batch ID가 있으면 Importer가 필요합니다.');
  }

  if (
    createdAt !== null &&
    updatedAt !== null &&
    Date.parse(updatedAt) < Date.parse(createdAt)
  ) {
    addIssue(
      issues,
      'updatedAt',
      'invalid_timestamp_order',
      '수정 시각은 생성 시각보다 빠를 수 없습니다.',
    );
  }

  if (
    issues.length > 0 ||
    id === null ||
    occurredOn === null ||
    amountMinor === null ||
    currency === null ||
    direction === null ||
    type === null ||
    descriptionOriginal === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return { isValid: false, issues };
  }

  return {
    isValid: true,
    value: {
      id,
      occurredOn,
      amountMinor,
      currency,
      direction,
      type,
      ...(categoryId === undefined ? {} : { categoryId }),
      descriptionOriginal,
      ...(merchantOriginal === undefined ? {} : { merchantOriginal }),
      ...(merchantNormalized === undefined ? {} : { merchantNormalized }),
      ...(paymentInstrumentLabel === undefined
        ? {}
        : { paymentInstrumentLabel }),
      ...(memo === undefined ? {} : { memo }),
      ...(importBatchId === undefined ? {} : { importBatchId }),
      ...(importerId === undefined ? {} : { importerId }),
      createdAt,
      updatedAt,
    },
  };
}
