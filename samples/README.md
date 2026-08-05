# Sample Data Policy

금융 파일은 민감한 개인정보다. 샘플은 목적에 따라 경로를 분리한다.

## `samples/example/`

- Git에 포함할 수 있는 명백한 가짜 데이터만 둔다.
- 실제 금융기관 형식처럼 가장하지 않고 `Generic Test Format`이라고 표시한다.
- 실명, 실제 계정·카드 번호, 실제 거래 조합을 사용하지 않는다.

## `samples/private/`

- 사용자가 직접 제공한 실제 형식의 샘플을 로컬에서만 임시 보관하는 경로다.
- 가능한 범위에서 먼저 개인정보를 마스킹한다.
- `.gitignore`로 전체 경로를 제외하며 강제로 `git add`하지 않는다.
- 작업이 끝난 뒤 원본 보관 필요성을 다시 확인한다.

## Commit 전 점검

```text
git status --short
git diff --cached --name-only
```

파일명 자체도 개인정보를 포함할 수 있으므로 staged 목록을 함께 확인한다.
