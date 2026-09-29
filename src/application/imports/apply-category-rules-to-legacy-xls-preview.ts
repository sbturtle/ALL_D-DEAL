import type { CategoryRule } from '../../domain/categories/category-rule';
import { normalizeCategoryRuleDescription } from '../../domain/categories/category-rule';
import { findDefaultCategoryKeyword } from '../../domain/categories/default-category-keywords';
import {
  findKeywordCategoryRule,
  type KeywordCategoryRule,
} from '../../domain/categories/keyword-category-rule';
import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';

export type CategoryRuleReader = Readonly<{
  listCategoryRules: () => Promise<readonly CategoryRule[]>;
  listKeywordCategoryRules: () => Promise<readonly KeywordCategoryRule[]>;
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

  const [rules, keywordRules] = await Promise.all([
    reader.listCategoryRules(),
    reader.listKeywordCategoryRules(),
  ]);
  const categoryIdByDescription = new Map(
    rules.map((rule) => [rule.matchDescriptionNormalized, rule.categoryId]),
  );

  return {
    ...preview,
    candidates: preview.candidates.map((candidate) => {
      if (candidate.draft.type !== 'EXPENSE') {
        return candidate;
      }

      const userRuleCategoryId =
        categoryIdByDescription.get(
          normalizeCategoryRuleDescription(candidate.draft.descriptionOriginal),
        ) ??
        findKeywordCategoryRule(
          candidate.draft.descriptionOriginal,
          keywordRules,
        )?.categoryId;

      if (userRuleCategoryId !== undefined) {
        return {
          ...candidate,
          draft: { ...candidate.draft, categoryId: userRuleCategoryId },
          categorySource: 'USER_RULE',
        };
      }

      const defaultCategoryId = findDefaultCategoryKeyword(
        candidate.draft.descriptionOriginal,
      )?.categoryId;

      return defaultCategoryId === undefined
        ? candidate
        : {
            ...candidate,
            draft: { ...candidate.draft, categoryId: defaultCategoryId },
            categorySource: 'DEFAULT_KEYWORD',
          };
    }),
  };
}
