# BOA 지점관리 CRM 권한 정책

이 문서는 현재 구현 기준의 역할별 접근 정책을 요약합니다. 권한은 서버 라우터에서 반드시 검증하며, 프론트엔드 메뉴/버튼 숨김은 보조 방어입니다.

## 공통 원칙

- `inactive`, `resigned` 사용자는 로그인과 보호 API 접근이 차단됩니다.
- 고객, 계약, 상담기록, 일정, 활동 로그는 일반 기능에서 hard delete하지 않습니다.
- 삭제, 복구, 완전삭제, 다운로드, OAuth 초기화, 강제 로그아웃 같은 위험 작업은 활동 로그에 기록합니다.
- 주민등록번호, 증권번호, 신분증, 병력상세, 계좌번호, 카드번호, 비밀키, DB URL, 토큰 원문은 저장하거나 로그에 남기지 않습니다.
- DB/API/RBAC enum은 영어 값을 유지하고, 사용자-facing 화면에서만 한글 표시명을 사용합니다.

## 사용자 화면 표시명

| 내부 값            | 화면 표시    |
| ------------------ | ------------ |
| `branch_admin`     | 지점장       |
| `sub_branch_admin` | 부지점장     |
| `team_leader`      | 팀장         |
| `member`           | 팀원         |
| `active`           | 활성         |
| `inactive`         | 비활성       |
| `resigned`         | 퇴사자       |
| `managed`          | 산하 전체    |
| `mine`             | 내 담당 고객 |
| `member` scope     | 조직원별     |

표시명 변경은 화면 렌더링 전용이며 DB 저장값, API payload, 라우터 권한 조건, 테스트 fixture enum 값은 변경하지 않습니다.

## branch_admin

- 전체 고객, 계약, 일정, 알림, 실적, 활동 로그를 조회할 수 있습니다.
- 사용자 관리, 팀 관리, 설정 관리, DB 일괄 업로드, 업로드 이력 관리, batch 취소, DB 배정, 데이터 다운로드를 수행할 수 있습니다.
- 삭제 데이터 관리, 복구, soft delete 데이터 완전삭제, 삭제 요청 승인/반려를 수행할 수 있습니다.
- 운영 점검, 활동 로그 고급 검색, 강제 로그아웃, 전체 로그아웃, OAuth 연결 초기화를 수행할 수 있습니다.
- 데이터 다운로드는 사유 입력이 필수입니다.

## sub_branch_admin

- 본인 산하 고객, 계약, 일정, 알림, 실적, 후속관리, 상담기록, 우선순위, 태그만 조회하거나 관리할 수 있습니다.
- 본인에게 배분된 DB를 산하 조직원에게만 배정할 수 있습니다.
- 본인 산하 계약에 한해 삭제 요청을 생성할 수 있습니다.
- 사용자 관리, 팀 관리, 업로드 이력 관리, batch 취소, 삭제 데이터 관리, 복구, 완전삭제, 운영 점검, 설정 관리, 데이터 다운로드, 보안 관리 기능은 사용할 수 없습니다.

## team_leader

- 본인 팀 고객, 계약, 일정, 알림, 실적, 후속관리, 상담기록, 우선순위, 태그만 조회하거나 관리할 수 있습니다.
- 본인 팀 계약에 한해 삭제 요청을 생성할 수 있습니다.
- DB 배정, 사용자 관리, 팀 관리, 업로드 이력 관리, batch 취소, 삭제 데이터 관리, 복구, 완전삭제, 운영 점검, 설정 관리, 데이터 다운로드, 보안 관리 기능은 사용할 수 없습니다.

## member

- 본인 담당 고객과 관련된 계약, 일정, 알림, 실적, 후속관리, 상담기록, 우선순위, 태그만 조회하거나 관리할 수 있습니다.
- 본인 담당 계약에 한해 삭제 요청을 생성할 수 있습니다.
- DB 배정, 사용자 관리, 팀 관리, 업로드 이력 관리, batch 취소, 삭제 데이터 관리, 복구, 완전삭제, 운영 점검, 설정 관리, 데이터 다운로드, 보안 관리 기능은 사용할 수 없습니다.

## inactive / resigned

- 로그인과 보호 API 접근이 차단됩니다.
- 고객, 계약, 일정, 알림, 실적, 삭제 요청, 복구, 완전삭제, 업로드 이력, 운영 점검, 다운로드, 보안 관리 기능을 사용할 수 없습니다.

## 위험 작업 권한표

| 작업                                      | 허용 역할                               | 서버 검증 기준                                            |
| ----------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| 삭제 데이터 조회                          | branch_admin                            | branch admin procedure                                    |
| 복구                                      | branch_admin                            | branch admin procedure                                    |
| 완전삭제                                  | branch_admin                            | branch admin procedure, soft delete 상태와 확인 문구 검증 |
| 계약 삭제 요청 생성                       | sub_branch_admin / team_leader / member | 계약 접근 범위 검증                                       |
| 삭제 요청 승인/반려                       | branch_admin                            | branch admin procedure                                    |
| 업로드 이력 조회                          | branch_admin                            | branch admin procedure                                    |
| batch 취소                                | branch_admin                            | branch admin procedure, 연결 운영 이력 검증               |
| 운영 점검 / 고급 감사 검색                | branch_admin                            | branch admin procedure                                    |
| 데이터 다운로드                           | branch_admin                            | branch admin procedure, 사유 필수                         |
| 강제 로그아웃 / OAuth 초기화              | branch_admin                            | branch admin procedure, 확인 문구와 사유 검증             |
| 후속관리 / 상담기록 / 고객 관리 메타 수정 | 권한 범위 내 active 사용자              | 고객 접근 범위 검증                                       |

## 모바일 메뉴

모바일 하단 메뉴와 더보기 메뉴는 데스크톱과 동일한 역할 조건을 사용합니다. 관리자 전용 메뉴가 표시되더라도 서버 라우터 권한 검증이 최종 방어선입니다.

## Permanent Delete Safeguard Policy

Customer and contract permanent delete is retained as a branch_admin-only high-risk operation. It is not removed, and the system is not forced into archive-only mode.

- Permanent delete is only available after soft delete/inactive state.
- Active customers/contracts must not be directly permanently deleted.
- Customer/contract permanent delete requires an operator reason and exact `완전삭제` confirmation text.
- Linked operational history blocks permanent delete. Customers with contracts, consultations, consent/status/assignment history, delete requests, notifications, or reminders remain inactive for audit retention. Contracts with contract history, delete requests, notifications, or reminders remain inactive for audit retention.
- Blocked attempts are logged as `PERMANENT_DELETE_BLOCKED`.
- Successful permanent delete logs only safe metadata: actor, target type/id, sanitized reason, linked summary, and minimal state. Full phone numbers, tokens, secrets, consultation body text, disease names, product names, and premium detail text must not be stored in activity log details.
- CRM-controlled permanent delete is different from operating directly on the production DB. Manual production DB hard delete/reset/drop/truncate remains forbidden.
