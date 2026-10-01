# 아키텍처 결정 기록

ADR은 기술 선택뿐 아니라 중요한 제품 요구가 왜 바뀌었는지를 기록한다. 새 결정은 다음 번호를 사용하고, 기존 결정을 대체하면 원 ADR의 상태를 `대체됨`으로 바꾸고 후속 ADR을 연결한다.

| ADR                                                                      | 상태     | 결정                                                                      |
| ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------- |
| [ADR-0001](ADR-0001-file-import-over-financial-api.md)                   | 채택 | 금융 API 직접 연동보다 사용자 주도 파일 Import를 우선한다.                |
| [ADR-0002](ADR-0002-local-first-architecture.md)                         | 채택 | 초기 금융 데이터 처리와 저장을 브라우저 내부로 제한한다.                  |
| [ADR-0003](ADR-0003-weekly-import-instead-of-realtime.md)                | 채택 | 실시간 동기화보다 주 1회 검토 흐름을 최적화한다.                          |
| [ADR-0004](ADR-0004-versioned-local-payroll-estimation.md)               | 채택 | 공식 근거를 버전으로 고정한 급여 추정 정책을 브라우저에서 실행한다.       |
| [ADR-0005](ADR-0005-manual-shared-payment-settlements.md)                | 채택 | 수동 정산 연결로 원장을 보존하며 생활비는 순지출로 집계한다.              |
| [ADR-0006](ADR-0006-duplicate-candidates-require-user-confirmation.md)   | 채택 | 중복 가능 후보는 기본 제외하고 사용자의 명시적 재포함 후에만 저장한다.    |
| [ADR-0007](ADR-0007-confirmed-description-category-rules.md)             | 채택 | 명시적으로 동의한 거래 설명 카테고리 규칙만 Preview에 재사용한다.         |
| [ADR-0008](ADR-0008-client-routes-for-financial-workflows.md)            | 채택 | 금융 작업 목적별 클라이언트 경로를 작은 자체 라우터로 분리한다.           |
| [ADR-0009](ADR-0009-card-expense-and-account-cashflow-classification.md) | 채택 | 카드 사용은 소비로, 계좌 거래는 유형 분류가 우선인 현금흐름으로 처리한다. |
| [ADR-0010](ADR-0010-kakao-map-web-sdk-opt-in-boundary.md)                | 채택 | Kakao 장소 검색은 Web SDK, 사전 고지와 Preview 전용 결과로 제한한다.      |
| [ADR-0011](ADR-0011-local-monthly-living-expense-goal.md)                | 채택 | 월 생활비 목표는 `LIVING` 자금통의 월간 순지출과만 비교한다.              |
| [ADR-0012](ADR-0012-merchant-entity-resolution-before-vector-search.md)  | 채택 | Vector Search보다 결정적 Merchant Entity Resolution을 먼저 적용한다.      |
| [ADR-0013](ADR-0013-confirmed-local-ledger-reset.md)                     | 채택 | 범위를 고지하고 재확인한 뒤에만 브라우저 로컬 장부를 초기화한다.          |
| [ADR-0014](ADR-0014-many-to-many-shared-payment-settlements.md)           | 채택 | 여러 지출과 여러 입금을 하나의 공동결제 정산으로 연결한다.                |
| [ADR-0015](ADR-0015-separate-expense-category-and-budget-bucket.md)      | 채택 | 카테고리와 자금통을 분리하고 거래·정산에 단일 자금통을 저장한다.          |
| [ADR-0016](ADR-0016-built-in-merchant-keyword-suggestions.md)            | 채택 | 널리 알려진 상호의 내장 기본 카테고리 추천을 Preview에만 적용한다.        |
| [ADR-0017](ADR-0017-versioned-local-ledger-backup.md)                    | 채택 | 로컬 장부 백업을 버전 있는 JSON으로 내보내고 검증 후 원자적으로 복원한다. |

## 새 ADR 기본 구조

```text
상태
최초 사용자 요구
이후 대화에서 확인된 문제
변경된 요구사항
결정
결정 이유
고려한 대안
장점
단점
향후 다시 검토할 조건
```
