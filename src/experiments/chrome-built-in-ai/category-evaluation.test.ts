import { describe, expect, it, vi } from 'vitest';

import {
  evaluateCategoryFixtures,
  summarizeCategoryEvaluation,
  type CategoryEvaluationRow,
} from './category-evaluation';
import { CATEGORY_FIXTURES } from './category-fixtures';
import {
  CATEGORY_RESPONSE_CONSTRAINT,
  CATEGORY_SYSTEM_PROMPT,
  EXPERIMENT_CATEGORY_IDS,
  parseCategoryResponse,
} from './category-prompt';
import { readLanguageModelApi, type LanguageModelSession } from './language-model-api';

function createFakeSession(answer: (input: string) => Promise<string>) {
  const destroyedClones: string[] = [];
  const prompt = vi.fn(answer);
  const base: LanguageModelSession = {
    prompt,
    clone: vi.fn(async () => {
      const clone: LanguageModelSession = {
        prompt,
        clone: () => Promise.reject(new Error('clone of clone')),
        destroy: () => {
          destroyedClones.push('destroyed');
        },
      };
      return clone;
    }),
    destroy: vi.fn(),
  };

  return { base, prompt, destroyedClones };
}

function row(overrides: Partial<CategoryEvaluationRow>): CategoryEvaluationRow {
  return {
    description: '가짜 상점',
    expectedCategoryId: 'CAFE',
    keywordCategoryId: undefined,
    prediction: { kind: 'UNKNOWN' },
    latencyMs: 10,
    ...overrides,
  };
}

describe('category prompt', () => {
  it('offers every built-in category except DATE plus UNKNOWN', () => {
    expect(EXPERIMENT_CATEGORY_IDS).not.toContain('DATE');
    expect(CATEGORY_RESPONSE_CONSTRAINT.enum).toEqual([
      ...EXPERIMENT_CATEGORY_IDS,
      'UNKNOWN',
    ]);

    for (const id of EXPERIMENT_CATEGORY_IDS) {
      expect(CATEGORY_SYSTEM_PROMPT).toContain(`- ${id} (`);
    }
  });

  it.each([
    ['"CAFE"', { kind: 'CATEGORY', categoryId: 'CAFE' }],
    ['"UNKNOWN"', { kind: 'UNKNOWN' }],
    ['"DATE"', { kind: 'INVALID', raw: '"DATE"' }],
    ['CAFE', { kind: 'INVALID', raw: 'CAFE' }],
    ['{"categoryId":"CAFE"}', { kind: 'INVALID', raw: '{"categoryId":"CAFE"}' }],
  ])('parses %s strictly', (raw, expected) => {
    expect(parseCategoryResponse(raw)).toEqual(expected);
  });
});

describe('CATEGORY_FIXTURES', () => {
  it('uses unique descriptions without card numbers or amounts', () => {
    const descriptions = CATEGORY_FIXTURES.map((fixture) => fixture.description);

    expect(new Set(descriptions).size).toBe(descriptions.length);
    expect(descriptions.filter((description) => /\d{4,}|\d[\d,]*\s*원/.test(description))).toEqual([]);
    expect(
      CATEGORY_FIXTURES.every((fixture) =>
        EXPERIMENT_CATEGORY_IDS.includes(fixture.expectedCategoryId),
      ),
    ).toBe(true);
  });
});

describe('evaluateCategoryFixtures', () => {
  it('asks a fresh clone per fixture with the response constraint and records keyword results', async () => {
    const { base, prompt, destroyedClones } = createFakeSession(async () => '"FOOD_DINING"');
    let clock = 0;
    const onProgress = vi.fn();

    const rows = await evaluateCategoryFixtures(
      [
        { description: '가짜 버거킹 테스트점', expectedCategoryId: 'FOOD_DINING' },
        { description: '가짜 이름없는상점', expectedCategoryId: 'OTHER' },
      ],
      base,
      { now: () => (clock += 5), onProgress },
    );

    expect(base.clone).toHaveBeenCalledTimes(2);
    expect(destroyedClones).toHaveLength(2);
    expect(prompt).toHaveBeenCalledWith('Transaction description: 가짜 버거킹 테스트점', {
      responseConstraint: CATEGORY_RESPONSE_CONSTRAINT,
    });
    expect(rows).toEqual([
      {
        description: '가짜 버거킹 테스트점',
        expectedCategoryId: 'FOOD_DINING',
        keywordCategoryId: 'FOOD_DINING',
        prediction: { kind: 'CATEGORY', categoryId: 'FOOD_DINING' },
        latencyMs: 5,
      },
      {
        description: '가짜 이름없는상점',
        expectedCategoryId: 'OTHER',
        keywordCategoryId: undefined,
        prediction: { kind: 'CATEGORY', categoryId: 'FOOD_DINING' },
        latencyMs: 5,
      },
    ]);
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });

  it('keeps going after a failed prompt and still destroys the clone', async () => {
    const { base, destroyedClones } = createFakeSession(async (input) => {
      if (input.includes('실패')) {
        throw new DOMException('quota', 'QuotaExceededError');
      }

      return '"CAFE"';
    });

    const rows = await evaluateCategoryFixtures(
      [
        { description: '가짜 실패상점', expectedCategoryId: 'OTHER' },
        { description: '가짜 카페', expectedCategoryId: 'CAFE' },
      ],
      base,
      { now: () => 0 },
    );

    expect(rows.map((item) => item.prediction)).toEqual([
      { kind: 'ERROR', errorName: 'QuotaExceededError' },
      { kind: 'CATEGORY', categoryId: 'CAFE' },
    ]);
    expect(destroyedClones).toHaveLength(2);
  });
});

describe('summarizeCategoryEvaluation', () => {
  it('separates keyword, AI, AI on keyword misses and keyword-then-AI tallies', () => {
    const summary = summarizeCategoryEvaluation([
      // 키워드 정답, AI 오답
      row({
        keywordCategoryId: 'CAFE',
        prediction: { kind: 'CATEGORY', categoryId: 'SHOPPING' },
        latencyMs: 30,
      }),
      // 키워드 오답, AI 정답: 조합에서는 키워드가 우선한다
      row({
        expectedCategoryId: 'SUBSCRIPTION',
        keywordCategoryId: 'SHOPPING',
        prediction: { kind: 'CATEGORY', categoryId: 'SUBSCRIPTION' },
        latencyMs: 10,
      }),
      // 키워드 미적중, AI 정답
      row({ prediction: { kind: 'CATEGORY', categoryId: 'CAFE' }, latencyMs: 20 }),
      // 키워드 미적중, AI UNKNOWN
      row({ prediction: { kind: 'UNKNOWN' }, latencyMs: 40 }),
      // 키워드 미적중, AI 형식 오류
      row({ prediction: { kind: 'INVALID', raw: 'x' }, latencyMs: 50 }),
    ]);

    expect(summary).toEqual({
      totalCount: 5,
      keyword: { correctCount: 1, wrongCount: 1, unclassifiedCount: 3 },
      ai: {
        correctCount: 2,
        wrongCount: 1,
        unclassifiedCount: 2,
        unknownCount: 1,
        invalidCount: 1,
        errorCount: 0,
      },
      aiOnKeywordMiss: { totalCount: 3, correctCount: 1, wrongCount: 0, unclassifiedCount: 2 },
      aiOnKeywordHit: { totalCount: 2, correctCount: 1, wrongCount: 1, unclassifiedCount: 0 },
      keywordThenAi: { correctCount: 2, wrongCount: 1, unclassifiedCount: 2 },
      latencyMs: { median: 30, p90: 50 },
    });
  });

  it('returns zero latency for an empty run', () => {
    expect(summarizeCategoryEvaluation([]).latencyMs).toEqual({ median: 0, p90: 0 });
  });
});

describe('readLanguageModelApi', () => {
  it('returns the API only when availability and create exist', () => {
    const api = { availability: async () => 'available', create: async () => undefined };

    expect(readLanguageModelApi({ LanguageModel: api })).toBe(api);
    expect(readLanguageModelApi({ LanguageModel: { create: api.create } })).toBeUndefined();
    expect(readLanguageModelApi({})).toBeUndefined();
  });
});
