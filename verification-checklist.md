# BOA CRM Verification Checklist

## Production-blocking checks

- [ ] No role can access data outside authorized scope through direct ID/API.
- [ ] `inactive` / `resigned` cannot log in.
- [ ] DB bulk import is `branch_admin` only.
- [ ] Bulk import blocks forbidden columns.
- [ ] Bulk import normalizes phone numbers and blocks duplicates.
- [ ] Bulk import server revalidates before saving.
- [ ] Notification mutations verify scope.
- [ ] `schedules.create targetUserId` allows another active user only for `branch_admin`.
- [ ] Schedule update/delete requires `branch_admin` or `schedules.userId === actor.id`.
- [ ] `contracts.contractHistory` verifies scope.
- [ ] `performance.agentStats` verifies scope.
- [ ] No 주민등록번호 field.
- [ ] No 증권번호 field.
- [ ] No actual `.env` or secret in repo.

## Recommended test commands

- `pnpm install`
- `pnpm check`
- `pnpm build`
- `pnpm test`

## Design token QA

- [ ] Primary, secondary, ghost, danger/destructive, and success buttons keep distinct hierarchy.
- [ ] Card, badge, status, and risk colors use BOA premium finance tokens consistently.
- [ ] Dashboard, CustomerList, CustomerDetail, Analytics, and OperationRisk smoke views have no mobile horizontal overflow at 360px and 390px.
- [ ] Dark mode, long Korean button labels, long badges, and card header actions remain readable without overlap.
- [ ] Shared token changes do not require DB, API, RBAC, or server contract changes.

## Required report style

Use:

- 완료
- 일부 완료
- 누락
- 확인 불가
