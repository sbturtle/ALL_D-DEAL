# Architecture

> 상태: Phase 3A Implemented Baseline — 실제 private XLS 브라우저 Preview는 `NEEDS_USER_INPUT`
>
> 기준일: 2026-08-05

## 목적

초기 애플리케이션은 백엔드가 없는 단일 사용자용 웹 앱이다. 이 문서는 구현을 앞서 확장하기 위한 설계가 아니라, 금융 파일 Parser와 UI의 결합을 막고 민감한 데이터를 사용자 기기 안에서 처리하기 위한 최소 경계를 정의한다.

관련 결정은 [ADR-0001 파일 Import](../adr/ADR-0001-file-import-over-financial-api.md), [ADR-0002 local-first](../adr/ADR-0002-local-first-architecture.md), [ADR-0003 주 1회 Import](../adr/ADR-0003-weekly-import-instead-of-realtime.md), [ADR-0004 버전 지정 급여 추정](../adr/ADR-0004-versioned-local-payroll-estimation.md)을 따른다.

## 현재와 목표 상태

### Phase 1–3A 구현 상태

- React + TypeScript + Vite 실행 기반과 lint, typecheck, test, build 명령이 있다.
- 급여 입력 UI가 버전 지정 2026년 정책을 사용하는 순수 `payroll-estimate` Domain을 직접 호출한다.
- 급여 입력과 결과는 메모리에서만 유지하며 Application·Infrastructure·Transaction 계층으로 전달하지 않는다.
- Dashboard는 실제 거래가 없는 상태와 명시적인 UI 전용 Mock fixture만 제공한다.
- 공통 Transaction 타입, 금액·달력 날짜·UTC instant 검증과 생활비 판정 규칙은 `src/domain/transactions/`에 구현되어 있다.
- Transaction 런타임 검증은 신뢰할 수 없는 `unknown` 입력의 모든 문제를 수집하되 원본 값과 금융 식별정보를 오류에 노출하지 않는다.
- SheetJS `0.20.3` 기반 legacy XLS Reader가 첫 시트를 메모리에서만 읽고, 계좌 거래·카드 이용 레이아웃을 ImportCandidate Preview로 정규화한다.
- XLS Preview는 UI → Application use case → Infrastructure reader 경계로 연결된다. 원본 파일명·Blob·전체 행은 저장하지 않는다.
- IndexedDB 확정 저장과 아래 Import 흐름의 Confirm 이후 단계는 Phase 3B 목표이며 현재 구현 완료를 뜻하지 않는다.

### 단계별 기술 방향

| 단계 | 결정 또는 후보 | 도입 시점 |
| --- | --- | --- |
| Web UI | React + TypeScript + Vite를 Phase 1 기본값으로 사용 | Phase 1 |
| 테스트 | Vitest + React Testing Library를 실제 UI 검증과 함께 도입 | Phase 1 |
| 로컬 저장 | Phase 3 첫 확정 저장은 Native IndexedDB를 기본값으로 사용. 복합 조회·마이그레이션 요구가 생기면 Dexie 재평가 | Phase 3 |
| 런타임 검증 | Phase 2 Transaction은 의존성 없는 TypeScript 검증 함수 사용. 외부 형식 계약이 복잡해질 때 도구 재평가 | Phase 2 |
| Legacy XLS | SheetJS `0.20.3`으로 `.xls` 첫 시트를 브라우저 메모리에서 읽고, 형식별 정규화는 Infrastructure에 둠 | Phase 3A |
| CSV | Papa Parse를 포함한 후보는 Generic CSV 요구가 구체화될 때 비교 | Phase 3 |
| XLSX/PDF | SheetJS, PDF.js 등은 실제 형식과 샘플이 생긴 Phase에만 검토 | Phase 7 |
| E2E | 핵심 브라우저 흐름이 생기고 단위·통합 테스트로 부족할 때 Playwright 검토 | 필요 시점 |

현재 Phase에 필요하지 않은 라이브러리는 설치하지 않는다. 새 의존성을 추가할 때 필요성, 대안, 선택 이유를 계획 또는 ADR에 기록한다.

## 핵심 원칙

1. 금융 파일의 읽기, 파싱, 정규화, 검증과 Preview는 브라우저에서 수행한다.
2. 원본 파일과 거래 데이터는 외부 API, 분석 도구, 원격 로그로 보내지 않는다.
3. 파일을 선택하자마자 저장하지 않고 `Preview → Confirm → Commit`을 지킨다.
4. 금융기관 고유 형식은 Infrastructure Adapter 안에 가두고 Domain에 노출하지 않는다.
5. 주 1회는 사용자 습관을 반영한 기본 흐름이며 강제 스케줄이나 도메인 제약이 아니다.
6. 사용 사례가 실제로 필요할 때만 경계와 인터페이스를 추가한다.

## 계층과 의존성

```text
UI ─────────────→ Application ─────────────→ Domain
                       ↑                        ↑
                       └──── Infrastructure ────┘

Composition Root: 구체 구현을 생성하고 서로 연결
```

화살표는 코드 의존 방향이다. Infrastructure는 Application이 실제로 요구하는 포트를 구현하고 Domain 타입을 사용할 수 있지만, Domain은 브라우저나 외부 라이브러리를 알지 않는다.

### UI

- React 화면과 사용자 상호작용을 담당한다.
- Application 사용 사례를 호출하고 결과를 표현한다.
- IndexedDB나 특정 금융기관 Parser를 직접 호출하지 않는다.
- 외부 문자열을 HTML로 해석하지 않고 기본적으로 텍스트로 렌더링한다.

### Application

- `prepareImport`, `confirmImport`, `listTransactions` 같은 사용자 목적 단위 흐름을 조율한다.
- Domain 규칙과 필요한 Infrastructure 포트를 연결한다.
- Preview 단계와 확정 저장 단계를 명확히 분리한다.
- 범용 CRUD Repository나 미래 기능용 포트를 미리 만들지 않는다.

### Domain

- Transaction, 금액, 거래 유형과 집계처럼 프레임워크와 무관한 규칙을 가진다.
- React, 브라우저 `File`, IndexedDB, SheetJS 같은 파일 라이브러리에 의존하지 않는다.
- 가능한 한 순수 함수로 검증하고 테스트한다.

### Infrastructure

- IndexedDB 저장, 파일 읽기, Import Adapter와 해시 생성 같은 브라우저 세부사항을 담당한다.
- 금융기관 원본 레코드를 Domain 후보로 변환한다.
- 사용자 화면을 렌더링하거나 카테고리 선택 UX를 결정하지 않는다.

### Composition Root

- 앱 시작 지점에서 구체 구현을 생성하고 Application에 연결한다.
- 모든 구현체를 알고 있어도 되는 유일한 위치다.

## 디렉터리 방향

필요한 기능이 생길 때 다음 수준으로 시작한다.

```text
src/
├── app/             # 시작점, 라우팅, composition
├── ui/              # 화면과 표현 컴포넌트
├── application/     # 사용 사례
├── domain/          # 금융 도메인 규칙과 타입
├── infrastructure/  # IndexedDB와 파일 Adapter
└── shared/          # 실제로 둘 이상 영역에서 쓰는 작은 공통 코드
```

기능이 커지면 각 계층 안을 `transactions`, `imports`, `dashboard`로 나눈다. 빈 디렉터리, 빈 인터페이스, 미래용 Factory는 미리 만들지 않는다.

## 목표 Import 흐름

```text
사용자가 파일 선택
  ↓
UI가 Import 준비 사용 사례 호출
  ↓
Adapter가 처리 가능 여부 확인
  ↓
금융기관별 Source Record 파싱
  ↓
공통 Transaction 후보로 정규화
  ↓
런타임 검증과 거래 유형 판정
  ↓
중복 후보 탐지
  ↓
메모리 기반 Preview
  ↓
사용자 수정·제외·확인
  ↓
ImportBatch와 Transaction을 원자적으로 Commit
  ↓
Dashboard 조회
```

중복 탐지는 Phase 4 전까지 목표 단계일 뿐 구현된 것으로 간주하지 않는다. 같은 파일 경고와 거래 중복 판정도 분리한다.

## Import Adapter 책임

목표 계약은 다음 세 책임으로 제한한다.

- `canHandle`: 확장자나 MIME만 믿지 않고 제한된 헤더 또는 내용으로 처리 가능성을 판단한다.
- `parse`: 원본을 금융기관별 Source Record로 읽고 행 단위 문제를 보고한다.
- `normalize`: Source Record를 저장 전 공통 Transaction 후보로 변환한다.

Adapter는 저장, Dashboard 집계, UI 렌더링, 사용자 카테고리 질문을 담당하지 않는다. Phase 3A는 `LegacyXlsPreviewReader`의 최소 Preview port로 구현한다. MyPDS와 금융기관별 Adapter는 마스킹된 실제 샘플을 확보한 뒤 설계한다.

## 저장 경계

- 정규화된 Transaction, 필요한 사용자 규칙, 최소 ImportBatch 메타데이터만 IndexedDB에 저장한다.
- 원본 PDF/CSV/XLSX Blob, 전체 원본 행, 민감할 수 있는 파일명은 기본적으로 저장하지 않는다.
- Preview 후보와 파싱 중간 데이터는 확정 전 메모리에만 둔다.
- Import 확정 시 Batch와 모든 Transaction을 하나의 IndexedDB 트랜잭션으로 저장한다.
- Native IndexedDB를 첫 구현의 기본값으로 하며 DB 스키마 버전과 마이그레이션은 Phase 3 첫 영속 모델을 도입할 때 정의한다.
- 복합 쿼리, 페이지네이션, 반응형 조회 또는 다단계 스키마 마이그레이션이 실제 요구가 되면 Dexie를 재평가한다.
- IndexedDB는 배포 origin에 묶이며 브라우저 데이터 삭제나 주소 변경으로 유실될 수 있다. 실제 데이터 사용 전에 삭제 UX와 백업·복구 전략을 별도 계획한다.
- local-first는 저장 데이터가 자동 암호화된다는 뜻이 아니다.

## 보안과 신뢰 경계

### 보호하는 범위

- 금융 데이터의 의도하지 않은 원격 전송
- 저장소와 테스트 fixture를 통한 실제 샘플 유출
- 로그, 오류 메시지, 스냅샷을 통한 원본 행 노출
- 비정상 입력으로 인한 무제한 메모리·처리 사용과 HTML 주입

### 초기 범위 밖 위협

- 감염된 운영체제
- 악성 브라우저 확장
- 로컬 디스크 전체 탈취에 대한 앱 수준 암호화

### Parser 안전 원칙

- 파일 확장자와 MIME은 힌트로만 사용하고 실제 내용과 크기를 검증한다.
- 파일 크기, 행 수, 셀·문자열 길이에 합리적인 제한을 둔다.
- XLSX 수식·매크로와 PDF 스크립트를 실행하지 않는다.
- 원본 행이나 식별자를 `console`, 원격 telemetry, 오류 객체에 담지 않는다.
- 해시는 암호화가 아니며 거래 중복의 유일한 근거로 사용하지 않는다.

구체 제한값은 지원할 입력 형식과 실제 샘플을 확인한 Phase에서 정한다.

## 품질 전략

- Domain 규칙은 빠른 단위 테스트로 검증한다.
- Application은 가짜 포트를 이용해 Preview와 Commit 경계를 통합 테스트한다.
- Infrastructure Adapter는 명백한 가짜 fixture와 경계 입력으로 계약을 검증한다.
- UI는 빈 상태, Mock Data, 오류와 확인 흐름을 Testing Library로 검증한다.
- 실제 브라우저에서만 확인 가능한 핵심 흐름이 생기면 최소 E2E를 추가한다.

## 보류한 결정

- Native IndexedDB 이후 Dexie로 전환할 구체 임계점
- Generic CSV 외부 형식에 별도 런타임 스키마 검증 도구가 필요한지
- Import Adapter의 구체 TypeScript 계약
- 중복 후보 점수, fingerprint 구성과 판정 임계값
- 환불의 원거래 연결과 월간 집계 기준
- 주간 집계 시작 요일
- 백업·복원과 앱 수준 암호화
- 정적 배포 주소, PWA, Android 확장 방식
- 다중 통화와 환율

이 결정들은 해당 Phase의 실제 요구와 검증 사례가 생기기 전에는 확정하지 않는다.
