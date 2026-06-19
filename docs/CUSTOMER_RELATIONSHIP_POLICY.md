# BOA CRM 고객 관계도 정책 (PR20)

## 목적

고객 상세 화면에서 **가족·소개·직장·법인** 관계를 전산화하여, 담당자가 고객 1명 단위 관리를 넘어 연결된 네트워크를 파악할 수 있게 합니다.

본 기능은 기존 상담기록, 후속관리, 고객 히스토리, 태그, 파이프라인 기능을 대체하지 않습니다.

## 관계 유형

| 코드 | 표시 라벨 (기본) |
|------|------------------|
| `family_spouse` | 배우자 |
| `family_child` | 자녀 (역방향: 부모) |
| `family_parent` | 부모 (역방향: 자녀) |
| `family_sibling` | 형제자매 |
| `referral` | 소개자 (역방향: 피소개자) |
| `coworker` | 직장동료 |
| `corporate_representative` | 법인 대표 |
| `corporate_employee` | 법인 임직원 |
| `friend` | 지인 |
| `other` | 기타 |

## 권한 기준 (서버 RBAC)

| 역할 | 조회 | 생성/수정/삭제 |
|------|------|----------------|
| `branch_admin` | 전체 | 전체 (범위 내 두 고객) |
| `sub_branch_admin` | 본인 산하 | 본인 산하 |
| `team_leader` | 본인 팀 | 본인 팀 |
| `member` | 본인 담당 고객 연결 관계 | **본인 담당 고객을 기준**으로만 |
| `inactive` / `resigned` | 차단 | 차단 |

- 두 고객 중 하나라도 권한 범위 밖이면 **생성/수정/삭제 차단**
- 관계 대상 고객 검색도 **권한 범위 내 고객만** 노출
- UI 버튼 숨김만으로 처리하지 않으며, **tRPC 라우터에서 반드시 검증**

## 민감정보 입력 금지

관계 `note`는 **짧은 업무 메모(최대 500자)** 수준만 허용합니다.

다음 정보는 입력하지 않습니다.

- 주민등록번호
- 질병명·병력·진단 상세
- 보험료·계약번호·증권번호
- 기타 고객 식별·계약 민감정보

저장 API는 패턴 기반으로 민감 입력을 거부합니다.

## activity log 저장 기준

`activity_logs`에는 다음만 저장합니다.

- `CUSTOMER_RELATIONSHIP_CREATED`
- `CUSTOMER_RELATIONSHIP_UPDATED`
- `CUSTOMER_RELATIONSHIP_DELETED`

메타데이터: `relationshipId`, `relationshipType`, `relationshipLabel`, `direction`, `status`

**저장하지 않음**: 고객명, 전화번호, note 전문, 생년월일, 보험/계약 정보

## 삭제 정책

- **hard delete 금지**
- `deletedAt` + `status=inactive` soft delete
- soft delete 후 목록에서 제외

## 중복 방지

- `primaryCustomerId === relatedCustomerId` 차단
- 동일 고객쌍 + `relationshipType` 중복 생성 차단

## 운영 시 주의사항

1. 가족/법인/소개 관계 등록 시 **고객 동의** 및 **개인정보 최소수집** 원칙을 준수합니다.
2. 관계 메모는 내부 업무용 요약만 남기고, 상담본문·계약 상세는 해당 기능(상담기록/계약)에 기록합니다.
3. Railway pre-deploy `pnpm db:migrate` 적용 후 `customer_relationships` 테이블 생성을 확인합니다.
4. 배포 후 고객 상세 **연결 고객** 탭에서 RBAC·타임라인·activity log 동작을 스테이징에서 검증합니다.

## 관련 코드

- Schema: `drizzle/schema.ts` (`customer_relationships`)
- Migration: `drizzle/0034_customer_relationships.sql`
- Router: `server/customerRelationships.ts`
- UI: `client/src/components/customers/CustomerRelationshipsPanel.tsx`
