import { isUtcIsoInstant } from './utc-iso-instant';
import type { UtcIsoInstant } from './utc-iso-instant';

export type BudgetSettlement = Readonly<{
  id: string;
  outflowTransactionIds: readonly string[];
  inflowTransactionIds: readonly string[];
  createdAt: UtcIsoInstant;
  updatedAt: UtcIsoInstant;
}>;

export type BudgetSettlementValidationIssue = Readonly<{
  field: string;
  code:
    | 'invalid_root'
    | 'required'
    | 'invalid_uuid'
    | 'invalid_outflow_ids'
    | 'invalid_inflow_ids'
    | 'overlapping_transaction_ids'
    | 'invalid_utc_instant'
    | 'invalid_timestamp_order'
    | 'unexpected_field';
}>;

export type BudgetSettlementValidationResult =
  | Readonly<{ isValid: true; value: BudgetSettlement }>
  | Readonly<{
      isValid: false;
      issues: readonly BudgetSettlementValidationIssue[];
    }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const SETTLEMENT_FIELDS = [
  'id',
  'outflowTransactionIds',
  'inflowTransactionIds',
  'createdAt',
  'updatedAt',
] as const;
const settlementFieldSet: ReadonlySet<string> = new Set(SETTLEMENT_FIELDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    UUID_PATTERN.test(value) &&
    value.toLowerCase() !== NIL_UUID
  );
}

export function validateBudgetSettlement(
  candidate: unknown,
): BudgetSettlementValidationResult {
  if (!isRecord(candidate)) {
    return {
      isValid: false,
      issues: [{ field: '$root', code: 'invalid_root' }],
    };
  }

  const issues: BudgetSettlementValidationIssue[] = [];
  const addIssue = (
    field: BudgetSettlementValidationIssue['field'],
    code: BudgetSettlementValidationIssue['code'],
  ) => issues.push({ field, code });
  const readUuid = (field: 'id') => {
    const value = candidate[field];
    if (value === undefined) {
      addIssue(field, 'required');
      return null;
    }
    if (!isUuid(value)) {
      addIssue(field, 'invalid_uuid');
      return null;
    }
    return value;
  };
  const readInstant = (field: 'createdAt' | 'updatedAt') => {
    const value = candidate[field];
    if (value === undefined) {
      addIssue(field, 'required');
      return null;
    }
    if (!isUtcIsoInstant(value)) {
      addIssue(field, 'invalid_utc_instant');
      return null;
    }
    return value;
  };

  const readTransactionIds = (
    field: 'outflowTransactionIds' | 'inflowTransactionIds',
    code: 'invalid_outflow_ids' | 'invalid_inflow_ids',
  ): readonly string[] | null => {
    const value = candidate[field];
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      !value.every(isUuid) ||
      new Set(value).size !== value.length
    ) {
      addIssue(field, code);
      return null;
    }

    return value;
  };

  const id = readUuid('id');
  const outflowTransactionIds = readTransactionIds(
    'outflowTransactionIds',
    'invalid_outflow_ids',
  );
  const inflowTransactionIds = readTransactionIds(
    'inflowTransactionIds',
    'invalid_inflow_ids',
  );

  if (
    outflowTransactionIds !== null &&
    inflowTransactionIds !== null &&
    outflowTransactionIds.some((transactionId) =>
      inflowTransactionIds.includes(transactionId),
    )
  ) {
    addIssue('$root', 'overlapping_transaction_ids');
  }

  const createdAt = readInstant('createdAt');
  const updatedAt = readInstant('updatedAt');

  if (
    createdAt !== null &&
    updatedAt !== null &&
    Date.parse(updatedAt) < Date.parse(createdAt)
  ) {
    addIssue('updatedAt', 'invalid_timestamp_order');
  }

  if (Object.keys(candidate).some((field) => !settlementFieldSet.has(field))) {
    addIssue('$root', 'unexpected_field');
  }

  if (
    issues.length > 0 ||
    id === null ||
    outflowTransactionIds === null ||
    inflowTransactionIds === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return { isValid: false, issues };
  }

  return {
    isValid: true,
    value: {
      id,
      outflowTransactionIds,
      inflowTransactionIds,
      createdAt,
      updatedAt,
    },
  };
}
