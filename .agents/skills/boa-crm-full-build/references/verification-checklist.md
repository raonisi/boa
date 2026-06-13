# BOA CRM Verification Checklist

## Production-blocking checks

- [ ] No role can access data outside authorized scope through direct ID/API.
- [ ] `inactive` / `resigned` cannot log in.
- [ ] DB bulk import is `branch_admin` only.
- [ ] Bulk import blocks forbidden columns.
- [ ] Bulk import normalizes phone numbers and blocks duplicates.
- [ ] Bulk import server revalidates before saving.
- [ ] Notification mutations verify scope.
- [ ] `schedules.create targetUserId` verifies scope.
- [ ] `contracts.contractHistory` verifies scope.
- [ ] `performance.agentStats` verifies scope.
- [ ] No 주민등록번호 field.
- [ ] No 증권번호 field.
- [ ] No actual `.env` or secret in repo.

## Recommended test commands

- `pnpm install`
- `pnpm build`
- `pnpm test`

## Required report style

Use:

- 완료
- 일부 완료
- 누락
- 확인 불가
