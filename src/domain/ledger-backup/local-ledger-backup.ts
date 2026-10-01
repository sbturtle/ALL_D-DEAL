import type {
  LocalLedgerBackup,
  LocalLedgerSnapshot,
} from './local-ledger-backup-types';
import type { UtcIsoInstant } from '../transactions/utc-iso-instant';

export * from './local-ledger-backup-types';
export {
  validateLocalLedgerBackup,
  validateLocalLedgerSnapshot,
} from './local-ledger-backup-validation';

export function createLocalLedgerBackup(
  snapshot: LocalLedgerSnapshot,
  exportedAt: UtcIsoInstant,
): LocalLedgerBackup {
  return {
    format: 'ALL_D_DEAL_LOCAL_LEDGER',
    version: 1,
    exportedAt,
    data: {
      transactions: [...snapshot.transactions],
      importBatches: [...snapshot.importBatches],
      budgetSettlements: [...snapshot.budgetSettlements],
      categoryRules: [...snapshot.categoryRules],
      keywordCategoryRules: [...snapshot.keywordCategoryRules],
      userSettings: snapshot.userSettings,
      budgetBuckets: [...snapshot.budgetBuckets],
      customCategories: [...snapshot.customCategories],
      transactionAttachments: [...snapshot.transactionAttachments],
    },
  };
}
