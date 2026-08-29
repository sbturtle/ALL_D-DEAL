import { describe, expect, it } from 'vitest';

import {
  createTransactionAttachment,
  validateTransactionAttachment,
} from './transaction-attachment';

const transactionId = '550e8400-e29b-41d4-a716-446655440001';
const updatedAt = '2026-08-29T00:00:00.000Z' as const;

describe('transaction attachments', () => {
  it('creates and validates a local image attachment', () => {
    const attachment = createTransactionAttachment({
      transactionId,
      dataUrl: 'data:image/png;base64,ZmFrZQ==',
      fileName: 'receipt.png',
      mimeType: 'image/png',
      sizeBytes: 5,
      updatedAt,
    });

    expect(attachment).toEqual({
      transactionId,
      dataUrl: 'data:image/png;base64,ZmFrZQ==',
      fileName: 'receipt.png',
      mimeType: 'image/png',
      sizeBytes: 5,
      updatedAt,
    });
    expect(validateTransactionAttachment(attachment)).toEqual({
      isValid: true,
      value: attachment,
    });
  });

  it('rejects non-image data and oversized attachments', () => {
    expect(
      createTransactionAttachment({
        transactionId,
        dataUrl: 'data:text/plain;base64,ZmFrZQ==',
        fileName: 'note.txt',
        mimeType: 'text/plain',
        sizeBytes: 5,
        updatedAt,
      }),
    ).toBeUndefined();
    expect(
      validateTransactionAttachment({
        transactionId,
        dataUrl: 'data:image/png;base64,ZmFrZQ==',
        fileName: 'receipt.png',
        mimeType: 'image/png',
        sizeBytes: 4 * 1024 * 1024,
        updatedAt,
      }),
    ).toEqual({ isValid: false, code: 'invalid_size' });
  });
});
