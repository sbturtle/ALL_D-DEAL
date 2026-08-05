# 프로젝트 문서 안내

이 디렉터리는 제품 의도부터 작업 결과까지 이어지는 프로젝트 지식의 기준이다. 채팅에서 새 요구나 결정이 생기면 관련 문서도 함께 갱신한다.

| 영역 | 문서 | 목적 |
| --- | --- | --- |
| 제품 | `product/product-context.md` | 프로젝트 배경, 사용자 가치, 장기 방향 |
| 요구사항 | `product/requirements.md` | 현재 유효한 기능·비기능 요구사항 |
| 요구 이력 | `product/requirements-history.md` | 요구사항이 바뀐 이유와 현재 결정 |
| 아키텍처 | `architecture/architecture.md` | 경계, 의존성 방향, 단계별 기술 전략 |
| 데이터 | `architecture/data-model.md` | Transaction 등 핵심 모델의 설계 근거 |
| 결정 | `adr/` | 중요한 제품·기술 선택과 재검토 조건 |
| 규약 | `conventions/code-convention.md` | 구현 및 테스트 규칙 |
| 계획 | `plans/current-plan.md` | 현재 수행할 단일 작업의 계획 |
| 완료 계획 | `plans/completed/` | 끝난 계획과 검증 근거 |
| 중단 계획 | `plans/blocked/` | 3회 시도 후 중단한 작업의 기록 |
| 작업 이력 | `logs/engineering-log.md` | 중요한 구현·검증 결과와 후속 작업 |

## 문서 갱신 원칙

- `requirements.md`에는 현재 유효한 상태만 적고 변경 과정은 `requirements-history.md`에 보존한다.
- 장기 영향을 주는 선택은 ADR로 남기고, 기존 결정을 바꿀 때는 원 ADR의 상태와 후속 ADR을 연결한다.
- `current-plan.md`는 구현보다 먼저 작성하며 완료 또는 중단 시 해당 디렉터리로 이동한다.
- 실제 금융 데이터나 식별 가능한 개인정보는 어떤 문서에도 기록하지 않는다.
