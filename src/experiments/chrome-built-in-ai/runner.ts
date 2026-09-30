import { CATEGORY_PRESENTATIONS } from '../../domain/categories/category-presentation';
import type { BuiltInCategoryId } from '../../domain/categories/category';

import {
  evaluateCategoryFixtures,
  summarizeCategoryEvaluation,
  type CategoryEvaluationRow,
  type CategoryEvaluationSummary,
  type ClassificationTally,
  type EvaluatedPrediction,
} from './category-evaluation';
import { CATEGORY_FIXTURES } from './category-fixtures';
import { CATEGORY_SYSTEM_PROMPT } from './category-prompt';
import {
  createTextLanguageOptions,
  readLanguageModelApi,
  type LanguageModelApi,
} from './language-model-api';

// 개발 서버 전용 실험 페이지. 결과는 화면과 자동화용 전역 상태에만 두고 저장하지 않는다.

type ExperimentState = {
  status: 'NO_API' | 'READY' | 'RUNNING' | 'DONE' | 'FAILED';
  message: string;
  availability: Record<string, string>;
  inputLanguages?: readonly string[];
  summary?: CategoryEvaluationSummary;
  rows?: readonly CategoryEvaluationRow[];
};

const LANGUAGE_CANDIDATES: readonly (readonly string[])[] = [['ko'], ['en']];
const USABLE_AVAILABILITY = new Set(['available', 'downloadable', 'downloading']);

const state: ExperimentState = { status: 'READY', message: '', availability: {} };
Reflect.set(window, '__chromeAiCategoryExperiment', state);

function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);

  if (!(element instanceof type)) {
    throw new Error(`#${id} 요소가 없습니다.`);
  }

  return element;
}

const statusElement = requireElement('status', HTMLParagraphElement);
const availabilityElement = requireElement('availability', HTMLUListElement);
const runButton = requireElement('run', HTMLButtonElement);
const summaryElement = requireElement('summary', HTMLUListElement);
const resultBody = requireElement('results', HTMLTableSectionElement);
requireElement('system-prompt', HTMLPreElement).textContent = CATEGORY_SYSTEM_PROMPT;

function setStatus(status: ExperimentState['status'], message: string): void {
  state.status = status;
  state.message = message;
  statusElement.textContent = message;
}

function labelOf(categoryId: BuiltInCategoryId | undefined): string {
  return categoryId === undefined ? '—' : CATEGORY_PRESENTATIONS[categoryId].label;
}

function describePrediction(prediction: EvaluatedPrediction): string {
  switch (prediction.kind) {
    case 'CATEGORY':
      return labelOf(prediction.categoryId);
    case 'UNKNOWN':
      return '모름(UNKNOWN)';
    case 'INVALID':
      return `형식 오류: ${prediction.raw}`;
    case 'ERROR':
      return `오류: ${prediction.errorName}`;
  }
}

function formatTally(tally: ClassificationTally, totalCount: number): string {
  return `정답 ${tally.correctCount}/${totalCount}, 오답 ${tally.wrongCount}, 미분류 ${tally.unclassifiedCount}`;
}

function appendListItem(list: HTMLUListElement, text: string): void {
  const item = document.createElement('li');
  item.textContent = text;
  list.append(item);
}

function renderSummary(summary: CategoryEvaluationSummary): void {
  summaryElement.replaceChildren();
  appendListItem(summaryElement, `키워드 기본 추천만: ${formatTally(summary.keyword, summary.totalCount)}`);
  appendListItem(
    summaryElement,
    `AI만: ${formatTally(summary.ai, summary.totalCount)} (UNKNOWN ${summary.ai.unknownCount}, 형식 오류 ${summary.ai.invalidCount}, 실행 오류 ${summary.ai.errorCount})`,
  );
  appendListItem(
    summaryElement,
    `키워드가 놓친 ${summary.aiOnKeywordMiss.totalCount}건에서 AI: ${formatTally(summary.aiOnKeywordMiss, summary.aiOnKeywordMiss.totalCount)}`,
  );
  appendListItem(
    summaryElement,
    `키워드가 잡은 ${summary.aiOnKeywordHit.totalCount}건에서 AI: ${formatTally(summary.aiOnKeywordHit, summary.aiOnKeywordHit.totalCount)}`,
  );
  appendListItem(
    summaryElement,
    `키워드 우선 + AI 보완: ${formatTally(summary.keywordThenAi, summary.totalCount)}`,
  );
  appendListItem(
    summaryElement,
    `응답 시간: 중앙값 ${Math.round(summary.latencyMs.median)}ms, p90 ${Math.round(summary.latencyMs.p90)}ms`,
  );
}

function renderRows(rows: readonly CategoryEvaluationRow[]): void {
  resultBody.replaceChildren(
    ...rows.map((row) => {
      const aiCategoryId = row.prediction.kind === 'CATEGORY' ? row.prediction.categoryId : undefined;
      const cells = [
        row.description,
        labelOf(row.expectedCategoryId),
        labelOf(row.keywordCategoryId),
        describePrediction(row.prediction),
        aiCategoryId === row.expectedCategoryId ? '✓' : '✗',
        `${Math.round(row.latencyMs)}`,
      ];
      const tableRow = document.createElement('tr');

      for (const text of cells) {
        const cell = document.createElement('td');
        cell.textContent = text;
        tableRow.append(cell);
      }

      return tableRow;
    }),
  );
}

async function checkAvailability(api: LanguageModelApi): Promise<void> {
  for (const languages of LANGUAGE_CANDIDATES) {
    const key = languages.join(',');

    try {
      state.availability[key] = await api.availability(createTextLanguageOptions(languages));
    } catch (error) {
      state.availability[key] = `오류: ${error instanceof Error ? error.name : String(error)}`;
    }

    appendListItem(availabilityElement, `입력 언어 ${key}: ${state.availability[key]}`);
  }
}

async function runExperiment(api: LanguageModelApi): Promise<void> {
  const inputLanguages = LANGUAGE_CANDIDATES.find((languages) =>
    USABLE_AVAILABILITY.has(state.availability[languages.join(',')] ?? ''),
  );

  if (inputLanguages === undefined) {
    setStatus('FAILED', '사용 가능한 입력 언어 설정이 없습니다.');
    return;
  }

  state.inputLanguages = inputLanguages;
  runButton.disabled = true;
  setStatus('RUNNING', `모델 세션 준비 중 (입력 언어 ${inputLanguages.join(',')})`);

  try {
    const baseSession = await api.create({
      ...createTextLanguageOptions(inputLanguages),
      initialPrompts: [{ role: 'system', content: CATEGORY_SYSTEM_PROMPT }],
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          const loaded: unknown = Reflect.get(event, 'loaded');
          setStatus(
            'RUNNING',
            `모델 내려받는 중 ${typeof loaded === 'number' ? Math.round(loaded * 100) : '?'}%`,
          );
        });
      },
    });

    try {
      const rows = await evaluateCategoryFixtures(CATEGORY_FIXTURES, baseSession, {
        onProgress: (completedCount, totalCount) => {
          setStatus('RUNNING', `평가 중 ${completedCount}/${totalCount}`);
        },
      });
      const summary = summarizeCategoryEvaluation(rows);

      state.rows = rows;
      state.summary = summary;
      renderSummary(summary);
      renderRows(rows);
      setStatus('DONE', `완료: ${rows.length}건 (입력 언어 ${inputLanguages.join(',')})`);
    } finally {
      baseSession.destroy();
    }
  } catch (error) {
    setStatus('FAILED', `세션을 만들지 못했습니다: ${error instanceof Error ? `${error.name} ${error.message}` : String(error)}`);
  } finally {
    runButton.disabled = false;
  }
}

async function start(): Promise<void> {
  const api = readLanguageModelApi();

  if (api === undefined) {
    setStatus(
      'NO_API',
      'LanguageModel API가 없습니다. PC Chrome에서 chrome://flags/#prompt-api-for-gemini-nano 를 켜고 다시 여세요.',
    );
    runButton.disabled = true;
    return;
  }

  await checkAvailability(api);
  setStatus('READY', `fixture ${CATEGORY_FIXTURES.length}건 준비됨. 실험 시작을 누르세요.`);
  runButton.addEventListener('click', () => {
    void runExperiment(api);
  });
  runButton.disabled = false;
}

void start();
