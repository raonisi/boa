# BOA CRM mode-aware verification

Select checks for the target and mode in [SKILL.md](../SKILL.md). The following product checks are not a default full-site audit.

## Skill and sourcepack checks

- For a narrow typo: inspect the named text and validate frontmatter only if touched.
- For substantial skill/sourcepack work: follow [governance](sourcepack-governance.md), validate structure with [validator](../scripts/validate.py), and execute realistic independent sessions from [public evaluation cases](../evals/cases.json). Discover actual Python/installed quick_validate paths; do not assume a CLI exists.
- Record host discovery separately from YAML validity. Preserve any existing agents/openai.yaml invocation policy/dependencies; do not disable implicit discovery without user request.
- Use external fixtures to test the validator; semantic policy judgments require source comparison and observed behavior.
- Bind check and action traces to the frozen candidate; verify bytes before and after. Missing behavior execution is NOT RUN/HOLD, never full validation.


## Conditional product safety checks

- [ ] No role can access data outside authorized scope through direct ID/API.
- [ ] `inactive` / `resigned` cannot log in.
- [ ] Before any import role conclusion, resolve IMPORT_ROLE against both sources or mark the affected permission gate HOLD; do not adopt the legacy admin-only assertion as approved policy.
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

## Conditional verification commands

Inspect installed tools and actual scripts/side effects first. For docs-only implementation use the repository docs-only baseline `pnpm.cmd check` when safely runnable. For authorized product implementation use check/test/build and E2E when routing/E2E/smoke is touched, according to AGENTS.md. Do not run install by default. PLAN/READ_ONLY_REVIEW permits only safe non-mutating checks and outside-target synthetic outputs. Failures authorize no unrelated product repairs. Report skipped product checks as outside scope for skill/sourcepack-only work.

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
