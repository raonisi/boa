# Codex Workflow Standard

This standard keeps BOA CRM Codex work lightweight without requiring agentmemory or extra tools.

## Default Workflow

- Use a single agent by default.
- Before editing, list likely affected files.
- Start with 5 or fewer files when possible.
- Expand scope only when correctness, safety, RBAC, DB/API integrity, customer-data protection, or required tests need it.
- When expanding scope, explain the reason in 1-2 short lines.
- Keep changes small, reviewable, and scoped to the requested task.
- Do not run full-codebase audits unless the task explicitly requires it.

## Full Audit Usage

Full audits are reserved for:

- monthly quality review
- large release readiness
- security/customer-data exposure review
- full UI/UX review
- repository-wide architecture or risk review

Use full audits for diagnosis first. Do not edit during an audit unless the user explicitly asks for implementation.

## Request Style

Good task requests are short and bounded: one sentence plus constraints.

Good example:

```text
BOA CRM /customers route만 검수한다.
목표는 DB 배정·담당자 지정 UX, RBAC 노출 위험, 모바일 사용성, 실패 상태 메시지다.
수정 전 먼저 문제 목록과 우선순위를 보고하고, 승인 없이 런타임 변경하지 마라.
```

Bad example:

```text
BOA CRM 전체 기능과 UI, UX, RBAC, DB, 서버, Railway, Playwright까지 전부 최고수준으로 검수해줘.
```

## Task Types

- `small hotfix`
- `scoped feature change`
- `PR review`
- `full audit`
- `security/RBAC-sensitive change`

## Decision Rule

```text
Feature-level issue = single-agent.
Role, DB, API, log, notification, assignment, or customer-data issue = limited parallel-agent.
Release, full UI/UX, or security-wide issue = full audit.
```

## Final Principle

Reduce waste, not quality. Token savings may remove repeated scans, unrelated exploration, and long logs. They must not reduce correctness, security, RBAC validation, customer-data protection, testing, or final verification.
