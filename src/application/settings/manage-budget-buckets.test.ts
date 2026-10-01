import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_BUDGET_BUCKETS, type BudgetBucket } from '../../domain/budget-buckets/budget-bucket';
import {
  addCustomBudgetBucket,
  archiveBudgetBucket,
  editBudgetBucketPresentation,
  type BudgetBucketManagementRepository,
} from './manage-budget-buckets';

function createRepository(
  buckets: readonly BudgetBucket[] = DEFAULT_BUDGET_BUCKETS,
): BudgetBucketManagementRepository & { saveBudgetBucket: ReturnType<typeof vi.fn> } {
  return {
    listBudgetBuckets: vi.fn().mockResolvedValue(buckets),
    saveBudgetBucket: vi.fn().mockResolvedValue(undefined),
  };
}

describe('manageBudgetBuckets', () => {
  it('adds a validated custom bucket after the current order', async () => {
    const repository = createRepository();

    await expect(
      addCustomBudgetBucket(
        { id: 'custom-travel', name: ' 여행 ', icon: ' ✈️ ' },
        repository,
      ),
    ).resolves.toMatchObject({
      isSaved: true,
      bucket: {
        id: 'custom-travel',
        name: '여행',
        icon: '✈️',
        order: 80,
        isDefault: false,
        isArchived: false,
      },
    });
    expect(repository.saveBudgetBucket).toHaveBeenCalledOnce();
  });

  it('edits a default presentation without changing its protected flags', async () => {
    const repository = createRepository();

    await expect(
      editBudgetBucketPresentation(
        { id: 'LIVING', name: '매달 쓰는 돈', icon: '🧺' },
        repository,
      ),
    ).resolves.toMatchObject({
      isSaved: true,
      bucket: { id: 'LIVING', isDefault: true, isArchived: false },
    });
  });

  it('archives a custom bucket but refuses to archive a default', async () => {
    const custom = {
      id: 'custom-travel',
      name: '여행',
      icon: '✈️',
      order: 80,
      isDefault: false,
      isArchived: false,
    } as const;
    const repository = createRepository([...DEFAULT_BUDGET_BUCKETS, custom]);

    await expect(archiveBudgetBucket(custom.id, repository)).resolves.toMatchObject({
      isSaved: true,
      bucket: { id: custom.id, isArchived: true },
    });
    await expect(archiveBudgetBucket('LIVING', repository)).resolves.toEqual({
      isSaved: false,
      code: 'default_bucket',
    });
    expect(repository.saveBudgetBucket).toHaveBeenCalledOnce();
  });
});
