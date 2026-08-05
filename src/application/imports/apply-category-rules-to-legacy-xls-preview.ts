import type { CategoryRule } from '../../domain/categories/category-rule';
import { normalizeCategoryRuleDescription } from '../../domain/categories/category-rule';
import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';

export type CategoryRuleReader = Readonly<{
  listCategoryRules: () => Promise<readonly CategoryRule[]>;
}>;

export async function applyCategoryRulesToLegacyXlsPreview(
  preview: ImportPreview,
  reader: CategoryRuleReader,
): Promise<ImportPreview> {
  const hasExpenseCandidate = preview.candidates.some(
    (candidate) => candidate.draft.type === 'EXPENSE',
  );

  if (!hasExpenseCandidate) {
    return preview;
  }

  const rules = await reader.listCategoryRules();
  const categoryIdByDescription = new Map(
    rules.map((rule) => [rule.matchDescriptionNormalized, rule.categoryId]),
  );

  return {
    ...preview,
    candidates: preview.candidates.map((candidate) => {
      if (candidate.draft.type !== 'EXPENSE') {
        return candidate;
      }

      const categoryId = categoryIdByDescription.get(
        normalizeCategoryRuleDescription(candidate.draft.descriptionOriginal),
      );

      return categoryId === undefined
        ? candidate
        : {
            ...candidate,
            draft: { ...candidate.draft, categoryId },
          };
    }),
  };
}
