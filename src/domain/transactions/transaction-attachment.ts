import { isUtcIsoInstant, type UtcIsoInstant } from './utc-iso-instant';

export const MAX_TRANSACTION_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const MAX_TRANSACTION_ATTACHMENT_FILE_NAME_LENGTH = 120;

export type TransactionAttachment = Readonly<{
  transactionId: string;
  dataUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: UtcIsoInstant;
}>;

export type TransactionAttachmentValidationResult =
  | Readonly<{ isValid: true; value: TransactionAttachment }>
  | Readonly<{
      isValid: false;
      code:
        | 'invalid_root'
        | 'unexpected_field'
        | 'invalid_transaction_id'
        | 'invalid_data_url'
        | 'invalid_file_name'
        | 'invalid_mime_type'
        | 'invalid_size'
        | 'invalid_timestamp';
    }>;

const TRANSACTION_ATTACHMENT_FIELDS = [
  'transactionId',
  'dataUrl',
  'fileName',
  'mimeType',
  'sizeBytes',
  'updatedAt',
] as const;
const transactionAttachmentFieldSet: ReadonlySet<string> = new Set(
  TRANSACTION_ATTACHMENT_FIELDS,
);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidTransactionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 80 &&
    !/\s/.test(value)
  );
}

function isValidDataUrl(value: unknown, mimeType: unknown): value is string {
  return (
    typeof value === 'string' &&
    typeof mimeType === 'string' &&
    value.startsWith(`data:${mimeType};`) &&
    value.includes(',')
  );
}

function isValidFileName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= MAX_TRANSACTION_ATTACHMENT_FILE_NAME_LENGTH
  );
}

function isValidMimeType(value: unknown): value is string {
  return typeof value === 'string' && /^image\/[a-z0-9.+-]+$/i.test(value);
}

function isValidSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_TRANSACTION_ATTACHMENT_BYTES
  );
}

export function createTransactionAttachment(input: TransactionAttachment) {
  return validateTransactionAttachment(input).isValid
    ? input
    : undefined;
}

export function validateTransactionAttachment(
  candidate: unknown,
): TransactionAttachmentValidationResult {
  if (!isPlainRecord(candidate)) {
    return { isValid: false, code: 'invalid_root' };
  }

  if (
    Object.keys(candidate).some(
      (field) => !transactionAttachmentFieldSet.has(field),
    )
  ) {
    return { isValid: false, code: 'unexpected_field' };
  }
  if (!isValidTransactionId(candidate.transactionId)) {
    return { isValid: false, code: 'invalid_transaction_id' };
  }
  if (!isValidMimeType(candidate.mimeType)) {
    return { isValid: false, code: 'invalid_mime_type' };
  }
  if (!isValidDataUrl(candidate.dataUrl, candidate.mimeType)) {
    return { isValid: false, code: 'invalid_data_url' };
  }
  if (
    !isValidFileName(candidate.fileName) ||
    candidate.fileName !== candidate.fileName.trim()
  ) {
    return { isValid: false, code: 'invalid_file_name' };
  }
  if (!isValidSize(candidate.sizeBytes)) {
    return { isValid: false, code: 'invalid_size' };
  }
  if (!isUtcIsoInstant(candidate.updatedAt)) {
    return { isValid: false, code: 'invalid_timestamp' };
  }

  return {
    isValid: true,
    value: {
      transactionId: candidate.transactionId,
      dataUrl: candidate.dataUrl,
      fileName: candidate.fileName,
      mimeType: candidate.mimeType,
      sizeBytes: candidate.sizeBytes,
      updatedAt: candidate.updatedAt,
    },
  };
}
