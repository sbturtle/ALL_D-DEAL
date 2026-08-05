import type { CalendarDate } from './calendar-date';
import type { Money } from './money';
import type { UtcIsoInstant } from './utc-iso-instant';
import type { CategoryId } from '../categories/category';

export const TRANSACTION_DIRECTIONS = ['INFLOW', 'OUTFLOW'] as const;
export const TRANSACTION_TYPES = [
  'EXPENSE',
  'INCOME',
  'TRANSFER',
  'CARD_PAYMENT',
  'SAVING',
  'INVESTMENT',
  'LOAN_PAYMENT',
  'REFUND',
  'UNKNOWN',
] as const;
export const TRANSACTION_IMPORTER_IDS = ['LEGACY_XLS'] as const;

export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type TransactionImporterId = (typeof TRANSACTION_IMPORTER_IDS)[number];

export type Transaction = Readonly<
  Money & {
    id: string;
    occurredOn: CalendarDate;
    direction: TransactionDirection;
    type: TransactionType;
    categoryId?: CategoryId;
    descriptionOriginal: string;
    merchantOriginal?: string;
    merchantNormalized?: string;
    paymentInstrumentLabel?: string;
    memo?: string;
    importBatchId?: string;
    importerId?: TransactionImporterId;
    createdAt: UtcIsoInstant;
    updatedAt: UtcIsoInstant;
  }
>;

const transactionDirectionSet: ReadonlySet<unknown> = new Set(
  TRANSACTION_DIRECTIONS,
);
const transactionTypeSet: ReadonlySet<unknown> = new Set(TRANSACTION_TYPES);
const transactionImporterIdSet: ReadonlySet<unknown> = new Set(
  TRANSACTION_IMPORTER_IDS,
);

export function isTransactionDirection(
  value: unknown,
): value is TransactionDirection {
  return transactionDirectionSet.has(value);
}

export function isTransactionType(value: unknown): value is TransactionType {
  return transactionTypeSet.has(value);
}

export function isTransactionImporterId(
  value: unknown,
): value is TransactionImporterId {
  return transactionImporterIdSet.has(value);
}
