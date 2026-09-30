import type { BuiltInCategoryId } from '../../domain/categories/category';
import { findDefaultCategoryKeyword } from '../../domain/categories/default-category-keywords';

import type { CategoryFixture } from './category-fixtures';
import {
  buildCategoryUserPrompt,
  CATEGORY_RESPONSE_CONSTRAINT,
  parseCategoryResponse,
  type CategoryPrediction,
  type ExperimentCategoryId,
} from './category-prompt';
import type { LanguageModelSession } from './language-model-api';

export type EvaluatedPrediction =
  | CategoryPrediction
  | Readonly<{ kind: 'ERROR'; errorName: string }>;

export type CategoryEvaluationRow = Readonly<{
  description: string;
  expectedCategoryId: ExperimentCategoryId;
  keywordCategoryId: BuiltInCategoryId | undefined;
  prediction: EvaluatedPrediction;
  latencyMs: number;
}>;

export type EvaluateCategoryFixturesOptions = Readonly<{
  now?: () => number;
  onProgress?: (completedCount: number, totalCount: number) => void;
}>;

// Prompt API 오류는 DOMException이며 실행 환경에 따라 Error를 상속하지 않을 수 있다.
function readErrorName(error: unknown): string {
  const name: unknown =
    typeof error === 'object' && error !== null ? Reflect.get(error, 'name') : undefined;

  return typeof name === 'string' ? name : 'UnknownError';
}

/**
 * 거래마다 기본 세션을 복제해 한 번만 묻고 폐기한다. 이전 거래의 대화가 다음 답에
 * 섞이지 않게 하려는 것이며, 한 거래의 실패는 ERROR 행으로 남기고 계속 진행한다.
 */
export async function evaluateCategoryFixtures(
  fixtures: readonly CategoryFixture[],
  baseSession: LanguageModelSession,
  { now = () => performance.now(), onProgress }: EvaluateCategoryFixturesOptions = {},
): Promise<readonly CategoryEvaluationRow[]> {
  const rows: CategoryEvaluationRow[] = [];

  for (const fixture of fixtures) {
    const startedAt = now();
    let prediction: EvaluatedPrediction;

    try {
      const session = await baseSession.clone();

      try {
        const raw = await session.prompt(buildCategoryUserPrompt(fixture.description), {
          responseConstraint: CATEGORY_RESPONSE_CONSTRAINT,
        });
        prediction = parseCategoryResponse(raw);
      } finally {
        session.destroy();
      }
    } catch (error) {
      prediction = { kind: 'ERROR', errorName: readErrorName(error) };
    }

    rows.push({
      description: fixture.description,
      expectedCategoryId: fixture.expectedCategoryId,
      keywordCategoryId: findDefaultCategoryKeyword(fixture.description)?.categoryId,
      prediction,
      latencyMs: now() - startedAt,
    });
    onProgress?.(rows.length, fixtures.length);
  }

  return rows;
}

export type ClassificationTally = Readonly<{
  correctCount: number;
  wrongCount: number;
  unclassifiedCount: number;
}>;

export type CategoryEvaluationSummary = Readonly<{
  totalCount: number;
  keyword: ClassificationTally;
  ai: ClassificationTally &
    Readonly<{ unknownCount: number; invalidCount: number; errorCount: number }>;
  aiOnKeywordMiss: ClassificationTally & Readonly<{ totalCount: number }>;
  aiOnKeywordHit: ClassificationTally & Readonly<{ totalCount: number }>;
  keywordThenAi: ClassificationTally;
  latencyMs: Readonly<{ median: number; p90: number }>;
}>;

type Outcome = 'CORRECT' | 'WRONG' | 'UNCLASSIFIED';

function judge(
  predictedCategoryId: BuiltInCategoryId | undefined,
  expectedCategoryId: ExperimentCategoryId,
): Outcome {
  if (predictedCategoryId === undefined) {
    return 'UNCLASSIFIED';
  }

  return predictedCategoryId === expectedCategoryId ? 'CORRECT' : 'WRONG';
}

function aiCategoryOf(row: CategoryEvaluationRow): ExperimentCategoryId | undefined {
  return row.prediction.kind === 'CATEGORY' ? row.prediction.categoryId : undefined;
}

function tally(outcomes: readonly Outcome[]): ClassificationTally {
  return {
    correctCount: outcomes.filter((outcome) => outcome === 'CORRECT').length,
    wrongCount: outcomes.filter((outcome) => outcome === 'WRONG').length,
    unclassifiedCount: outcomes.filter((outcome) => outcome === 'UNCLASSIFIED').length,
  };
}

function percentile(sortedValues: readonly number[], ratio: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const rank = Math.ceil(ratio * sortedValues.length);
  return sortedValues[Math.min(sortedValues.length, Math.max(1, rank)) - 1];
}

/** 키워드 우선 + AI 보완은 제품에 붙일 때의 적용 순서(키워드가 맞으면 AI를 묻지 않음)를 흉내 낸다. */
export function summarizeCategoryEvaluation(
  rows: readonly CategoryEvaluationRow[],
): CategoryEvaluationSummary {
  const keywordMissRows = rows.filter((row) => row.keywordCategoryId === undefined);
  const keywordHitRows = rows.filter((row) => row.keywordCategoryId !== undefined);
  const judgeAi = (row: CategoryEvaluationRow) =>
    judge(aiCategoryOf(row), row.expectedCategoryId);
  const sortedLatencies = rows.map((row) => row.latencyMs).sort((left, right) => left - right);

  return {
    totalCount: rows.length,
    keyword: tally(rows.map((row) => judge(row.keywordCategoryId, row.expectedCategoryId))),
    ai: {
      ...tally(rows.map(judgeAi)),
      unknownCount: rows.filter((row) => row.prediction.kind === 'UNKNOWN').length,
      invalidCount: rows.filter((row) => row.prediction.kind === 'INVALID').length,
      errorCount: rows.filter((row) => row.prediction.kind === 'ERROR').length,
    },
    aiOnKeywordMiss: {
      totalCount: keywordMissRows.length,
      ...tally(keywordMissRows.map(judgeAi)),
    },
    aiOnKeywordHit: {
      totalCount: keywordHitRows.length,
      ...tally(keywordHitRows.map(judgeAi)),
    },
    keywordThenAi: tally(
      rows.map((row) =>
        judge(row.keywordCategoryId ?? aiCategoryOf(row), row.expectedCategoryId),
      ),
    ),
    latencyMs: {
      median: percentile(sortedLatencies, 0.5),
      p90: percentile(sortedLatencies, 0.9),
    },
  };
}
