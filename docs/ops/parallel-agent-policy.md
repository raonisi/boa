# Parallel Agent Policy

BOA CRM work defaults to a single agent. Parallel agents are for correctness and safety, not for spectacle.

## Default

Use one agent for:

- small hotfixes
- scoped feature changes
- single-route checks
- isolated UI or form fixes
- docs-only cleanup
- narrow test failures

## Limited Parallel Agents

Use limited parallel work when the task spans multiple risk areas.

Default maximum: 3 agents.

1. Product/UX
   - user flow
   - screen behavior
   - CTA, empty, loading, error, forbidden states
   - operational usability

2. Backend/RBAC
   - API contracts
   - authorization
   - role scope
   - branch/team hierarchy
   - customer-data safety

3. QA/Test
   - required tests
   - role scenarios
   - regression risks
   - verification commands

## Maximum 6-Agent Setup

Use up to 6 agents only for large audits or pre-release verification.

1. Product/UX
   - screen flow and customer usability
   - report-focused

2. Frontend
   - UI component changes
   - limited to `client/src`

3. Backend/RBAC
   - API, permission, and data flow
   - limited to `server` and `shared`

4. QA
   - tests and regression review
   - test-file focused

5. Security
   - sensitive data and permission leakage
   - report-focused

6. Orchestrator
   - final integration decision
   - final diff cleanup

## Conflict Rules

- Do not let multiple agents edit the same file at the same time.
- Report-only agents should not modify code.
- The final orchestrator owns the final diff.
- The reason for parallel work must be clear.
- Parallel work spends more tokens, so use it only when it improves accuracy, safety, or review quality.
