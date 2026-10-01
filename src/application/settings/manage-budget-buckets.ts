import {
  archiveCustomBudgetBucket,
  createCustomBudgetBucket,
  updateBudgetBucketPresentation,
  type BudgetBucket,
  type BudgetBucketId,
} from '../../domain/budget-buckets/budget-bucket';

export type BudgetBucketManagementRepository = Readonly<{
  listBudgetBuckets: () => Promise<readonly BudgetBucket[]>;
  saveBudgetBucket: (bucket: BudgetBucket) => Promise<void>;
}>;

type SaveBudgetBucketResult =
  | Readonly<{ isSaved: true; bucket: BudgetBucket }>
  | Readonly<{
      isSaved: false;
      code: 'invalid_bucket' | 'duplicate_id' | 'not_found' | 'default_bucket' | 'storage_failed';
    }>;

export async function addCustomBudgetBucket(
  input: Readonly<{ id: BudgetBucketId; name: string; icon: string }>,
  repository: BudgetBucketManagementRepository,
): Promise<SaveBudgetBucketResult> {
  try {
    const buckets = await repository.listBudgetBuckets();
    if (buckets.some((bucket) => bucket.id === input.id)) {
      return { isSaved: false, code: 'duplicate_id' };
    }

    const nextOrder = buckets.reduce(
      (largestOrder, bucket) => Math.max(largestOrder, bucket.order),
      0,
    ) + 10;
    const bucket = createCustomBudgetBucket({ ...input, order: nextOrder });
    if (bucket === undefined) {
      return { isSaved: false, code: 'invalid_bucket' };
    }

    await repository.saveBudgetBucket(bucket);
    return { isSaved: true, bucket };
  } catch {
    return { isSaved: false, code: 'storage_failed' };
  }
}

export async function editBudgetBucketPresentation(
  input: Readonly<{ id: BudgetBucketId; name: string; icon: string }>,
  repository: BudgetBucketManagementRepository,
): Promise<SaveBudgetBucketResult> {
  try {
    const bucket = (await repository.listBudgetBuckets()).find(
      (candidate) => candidate.id === input.id,
    );
    if (bucket === undefined) {
      return { isSaved: false, code: 'not_found' };
    }

    const updatedBucket = updateBudgetBucketPresentation(bucket, input);
    if (updatedBucket === undefined) {
      return { isSaved: false, code: 'invalid_bucket' };
    }

    await repository.saveBudgetBucket(updatedBucket);
    return { isSaved: true, bucket: updatedBucket };
  } catch {
    return { isSaved: false, code: 'storage_failed' };
  }
}

export async function archiveBudgetBucket(
  id: BudgetBucketId,
  repository: BudgetBucketManagementRepository,
): Promise<SaveBudgetBucketResult> {
  try {
    const bucket = (await repository.listBudgetBuckets()).find(
      (candidate) => candidate.id === id,
    );
    if (bucket === undefined) {
      return { isSaved: false, code: 'not_found' };
    }
    if (bucket.isDefault) {
      return { isSaved: false, code: 'default_bucket' };
    }

    const archivedBucket = archiveCustomBudgetBucket(bucket);
    if (archivedBucket === undefined) {
      return { isSaved: false, code: 'invalid_bucket' };
    }

    await repository.saveBudgetBucket(archivedBucket);
    return { isSaved: true, bucket: archivedBucket };
  } catch {
    return { isSaved: false, code: 'storage_failed' };
  }
}
