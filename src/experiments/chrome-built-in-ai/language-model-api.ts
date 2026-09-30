// Chrome 내장 AI Prompt API 중 이 실험이 쓰는 최소 표면만 정의한다.
// 표준 TypeScript DOM 타입에 아직 없으므로 런타임에서 존재를 확인한 뒤 사용한다.

export type LanguageModelTextExpectation = Readonly<{
  type: 'text';
  languages: readonly string[];
}>;

export type LanguageModelLanguageOptions = Readonly<{
  expectedInputs: readonly LanguageModelTextExpectation[];
  expectedOutputs: readonly LanguageModelTextExpectation[];
}>;

export type LanguageModelPromptOptions = Readonly<{
  responseConstraint: unknown;
}>;

export type LanguageModelSession = {
  prompt(input: string, options: LanguageModelPromptOptions): Promise<string>;
  clone(): Promise<LanguageModelSession>;
  destroy(): void;
};

export type LanguageModelCreateOptions = LanguageModelLanguageOptions &
  Readonly<{
    initialPrompts: readonly Readonly<{ role: 'system'; content: string }>[];
    monitor?: (monitor: EventTarget) => void;
  }>;

export type LanguageModelApi = {
  availability(options: LanguageModelLanguageOptions): Promise<string>;
  create(options: LanguageModelCreateOptions): Promise<LanguageModelSession>;
};

export function readLanguageModelApi(
  scope: object = globalThis,
): LanguageModelApi | undefined {
  const candidate: unknown = Reflect.get(scope, 'LanguageModel');

  if (
    (typeof candidate !== 'object' && typeof candidate !== 'function') ||
    candidate === null ||
    typeof Reflect.get(candidate, 'availability') !== 'function' ||
    typeof Reflect.get(candidate, 'create') !== 'function'
  ) {
    return undefined;
  }

  // 두 메서드의 존재만 확인할 수 있고 시그니처는 Chrome 문서의 계약을 따른다.
  return candidate as LanguageModelApi;
}

export function createTextLanguageOptions(
  inputLanguages: readonly string[],
): LanguageModelLanguageOptions {
  return {
    expectedInputs: [{ type: 'text', languages: inputLanguages }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
  };
}
