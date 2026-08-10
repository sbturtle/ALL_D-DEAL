# 10A단계 — 다대다 공동결제 정산

- 상태: `DONE`
- 완료일: 2026-08-10

## 목표와 결과

공동결제 정산 하나에 여러 지출과 여러 수입을 연결할 수 있게 했다. `BudgetSettlement`는 `outflowTransactionIds`와 `inflowTransactionIds` 배열을 사용하며, 생활비에는 연결 묶음의 순지출만 반영한다.

## 구현 범위

- 배열별 중복·교차·방향·다른 정산과의 중복 연결을 검증했다.
- IndexedDB를 v5로 올리고 기존 단일 원결제 레코드를 배열 모델로 변환했다.
- 지출·입금을 각각 다중 선택하는 화면과 순지출 미리보기를 추가했다.
- 요구사항, ADR, 저장 계약, 데이터 모델과 엔지니어링 로그를 한국어로 갱신했다.

## 검증

| 검사 | 결과 |
| --- | --- |
| 도메인·저장소·UI 테스트 | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 43개 파일, 436개 테스트 |
| `npm run build` | PASS — 기존 청크 크기 경고만 존재 |
| `git diff --check` | PASS |

