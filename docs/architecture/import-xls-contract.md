# Legacy XLS Import Contract

> 상태: Phase 3A 구현·실제 private XLS Preview 검증 완료
>
> 기준일: 2026-08-05

## 목적

사용자가 직접 선택한 legacy `.xls` 파일을 브라우저 메모리에서만 읽고, 저장 전에 안전한 ImportCandidate Preview를 만든다. 지원 형식은 Git에서 제외한 `samples/private/`의 카드 이용내역과 계좌 거래내역 구조를 참고해 정한다. 원본 파일명, Blob, 전체 원본 행과 실제 금융 식별정보는 저장·로그·테스트 fixture에 남기지 않는다.

## 지원하는 레이아웃

### Account Ledger XLS

- 첫 시트의 초기 행 안에 날짜, 설명, 출금 금액, 입금 금액 헤더가 있다.
- 한 행에서 출금·입금 중 정확히 하나만 양의 KRW 정수여야 한다.
- 출금은 `OUTFLOW`, 입금은 `INFLOW` 후보가 된다.
- Phase 6B부터 거래 방향과 거래 설명의 명시적 표식을 작은 규칙 엔진으로 분류한다. 결과는 `type`, 비식별 `reasonCode`, `confidence`를 가진 Preview 메타데이터이며, 원문 행이나 거래 설명 사본을 추가 저장하지 않는다.
- 우선 `CARD_PAYMENT`, `SAVING`, `LOAN_PAYMENT`, `INVESTMENT`, `TRANSFER`, `INCOME`, `REWARD`를 안전한 방향 조건과 함께 판별한다. 일치하지 않으면 `UNKNOWN`과 검토 필요 상태로 남긴다.
- `SELF_TRANSFER`는 본인 계좌 별칭을 사용자가 설정하기 전에는 자동 판별하지 않는다. 이체 표식만 있는 후보는 `TRANSFER` 또는 `UNKNOWN`으로 검토한다.
- 계좌의 `CARD_PAYMENT`는 카드 사용 거래를 다시 소비로 만들지 않는 현금흐름이다. 생활비 집계는 `EXPENSE + OUTFLOW`만 포함하므로 이 유형은 제외된다.

### Card Usage XLS

- 첫 시트의 초기 행 안에 날짜, 시각, 마스킹된 카드 표기, 이용처, 원화 금액, 보조 통화 금액, 거래 상태와 승인 식별자 열이 있다.
- 원화 금액이 양의 KRW safe integer이고 보조 통화 금액이 0인 매입 행만 `EXPENSE + OUTFLOW` 후보가 된다.
- 취소·역분개 행과 외화 금액 행은 자동 반영하지 않고 확인 필요 issue로 Preview한다.
- 카드 표기는 원문을 보존하지 않는다. 숫자가 있으면 끝 4자리만 이용한 안전한 라벨을 만들고, 숫자가 없으면 일반 `카드` 라벨만 사용한다.

## 파일 및 처리 제한

- `.xls` 확장자와 사용자 File API로 받은 바이트만 처리한다. 경로나 파일명은 UI·저장·오류에 남기지 않는다.
- 최대 파일 크기 5 MiB, 최대 2,000행, 최대 20열, 최대 셀 문자열 길이 300자다.
- 첫 번째 시트만 검사하며 수식, HTML, 매크로 실행과 외부 링크는 사용하지 않는다.
- 검증·오류 메시지는 행 번호, 일반화된 코드와 안전한 설명만 포함한다. 원본 값과 예상하지 않은 열 이름을 되비추지 않는다.

## Preview 결과

```text
파일 선택
  → XLS 형식·크기·행/열 제한 검사
  → 지원 레이아웃 판별
  → ImportCandidate 또는 행 단위 issue 생성
  → 사용자가 메모리에서 Preview
  → (Phase 3B) 확인된 후보만 Transaction으로 완성·저장
```

`ImportCandidate`는 `Transaction`이 아니다. Import 출처·행 번호·Review 상태를 메모리에만 들고, Phase 3B의 명시적 확인 시점에만 UUID와 UTC 시각을 부여해 Transaction으로 만든다.

Phase 6B의 계좌 분류 메타데이터도 `ImportCandidate`에만 존재한다. 저장 확정 시에는 검증된 `Transaction.type`만 보존하며, 분류 근거·확신 수준·원본 행은 저장하지 않는다.

## 카드·계좌 역할과 분류 순서

1. 카드 이용내역을 `EXPENSE + OUTFLOW` 소비 후보로 만든다.
2. 계좌 거래내역을 입출금 현금흐름 후보로 만들고, 먼저 거래 유형을 분류한다.
3. 새 `EXPENSE` 후보에만 카테고리 규칙과 사용자의 빠른 카테고리 선택을 적용한다.
4. `CARD_PAYMENT`는 카드 지출의 결제 현금흐름으로 남겨 생활비에서 제외한다.

카테고리와 거래 유형은 같은 값이 아니다. 유형은 돈의 성격과 집계 방식을, 카테고리는 소비 항목을 표현한다. 따라서 수입·저축·대출상환·이체·카드대금·리워드에는 카테고리 규칙을 적용하지 않는다.

## 오류 코드

| 코드 | Preview 처리 |
| --- | --- |
| `unsupported_file` | 파일 형식 또는 크기가 지원 범위를 벗어남 |
| `unsupported_layout` | 지원하는 계좌·카드 XLS 레이아웃이 아님 |
| `invalid_date` | 거래일을 CalendarDate로 만들 수 없음 |
| `invalid_amount` | 양의 KRW safe integer가 아니거나 입금·출금이 모호함 |
| `reversal_requires_review` | 카드 취소·역분개 행이라 자동 반영하지 않음 |
| `foreign_currency_requires_review` | KRW 외 금액이 있어 자동 반영하지 않음 |
| `invalid_text` | 필수 설명이 비어 있거나 너무 김 |

## 비범위

- 실제 금융기관명 노출, 기관 API·MyData 연동
- CSV, XLSX, PDF, 다중 시트와 암호화된 파일 지원
- 취소·환불의 원거래 연결과 자동 순액 처리
- 사용자 정의 Category, Dashboard 카테고리 집계, 원본 파일·Blob 저장
