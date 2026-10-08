# BOA CRM Agent Escalation Policy

Version: 1.0
Status: ACTIVE
Canonical path: `docs/agent/BOA_AGENT_ESCALATION_POLICY.md`

## 1. Core Principle

Antigravity is the default Builder.

Codex is the default Independent Auditor.

Standard escalation:

`AG_IMPLEMENTATION_1`
→ `CODEX_GATE_1`

If PASS:
→ `CLOSE`

If FAIL:
→ `AG_REMEDIATION_1`

Then:
→ `CODEX_GATE_2`

If PASS:
→ `CLOSE`

If FAIL:
→ stop normal Antigravity repair loop
→ `CODEX_IMPLEMENTATION_TAKEOVER`

After Codex implementation:
→ separate `CODEX_FINAL_INDEPENDENT_GATE`

A Codex implementation task may not grant final independent approval to its own implementation.

---

## 2. Antigravity Remediation Limit

After the first Codex FAIL,
Antigravity receives exactly one normal targeted remediation opportunity.

The remediation must be limited to:

- Codex findings
- minimum changes required to resolve them
- directly relevant regression validation

Forbidden during targeted remediation:

- scope expansion
- unrelated refactor
- new functionality
- unrelated architecture redesign
- dependency upgrades
- unrelated cleanup

---

## 3. Second Codex FAIL

If `CODEX_GATE_2` still finds a blocker:

- stop further normal Antigravity repair loops;
- switch to `CODEX_IMPLEMENTATION_TAKEOVER`.

Further Antigravity repair is allowed only under an explicit:

`MINOR_EXCEPTION`

---

## 4. Minor Exception

`MINOR_EXCEPTION` is limited to obvious non-structural defects such as:

- typo
- filename
- path
- formatting
- wording
- obvious 1–2 line non-semantic mistake

It is permitted only when ALL are true:

- no architecture impact
- no DB impact
- no API semantic impact
- no RBAC/security impact
- no data-integrity impact
- no meaningful regression surface
- root cause is certain
- repair scope is trivial

If classification is uncertain:

`CODEX_IMPLEMENTATION_TAKEOVER`

is preferred.

---

## 5. High-Risk Domains

Treat these as high risk:

- DB
- migration
- schema semantics
- RBAC
- authorization
- authentication
- security
- transactions
- concurrency
- idempotency
- data integrity
- production rollout
- rollback
- evidence/provenance
- evaluator
- validator
- audit framework
- Final Gate implementation

These domains may escalate to Codex earlier than the normal two-gate sequence.

---

## 6. Immediate Escalation Signals

Prefer early Codex takeover when any of the following recur:

- same root cause
- authored PASS
- hardcoded true/false used as evidence
- before evidence copied to after evidence
- historical/saved PASS reused as current truth
- direct mutation of gate Boolean in a negative control
- self-approving evaluator or validator
- fabricated evidence
- detached proof accepted as runtime proof
- remediation introduces another structural blocker

---

## 7. Codex Takeover Separation

When Codex performs implementation:

Implementation task may perform:

- implementation
- execution
- tests
- self-validation
- regression validation
- evidence generation
- candidate preparation
- `READY FOR FINAL INDEPENDENT GATE`

Implementation task may NOT perform:

- final independent approval of its own implementation
- final closure based only on self-validation

A separate Codex task must perform:

`CODEX_FINAL_INDEPENDENT_GATE`

---

## 8. Model Selection Policy

Model choice is NOT permanently fixed to one Codex model.

Choose from:

### Codex — GPT-6.1 Sol

- `GPT-6.1 Sol · 높음`
- `GPT-6.1 Sol · 매우높음`
- `GPT-6.1 Sol · 울트라`

### Codex — GPT-6.0 Astra

- `GPT-6.0 Astra · 높음`
- `GPT-6.0 Astra · 매우높음`
- `GPT-6.0 Astra · 울트라`

Both Sol and Astra are officially allowed.

The prompt author must choose the model and effort appropriate to the task.

### Default operating preference

General Codex audit:

`GPT-6.1 Sol · 높음`

Important Final Quality Gate:

`GPT-6.1 Sol · 매우높음`

Codex Implementation Takeover:

`GPT-6.1 Sol · 매우높음`

However, GPT-6.0 Astra may be selected whenever it is judged more suitable for the specific task.

### Reasons to consider Astra

Astra may be deliberately selected when:

- an alternative reasoning path is valuable;
- broad architecture synthesis is required;
- a second-model perspective would materially strengthen confidence;
- Sol produced ambiguous or conflicting conclusions;
- the task is sufficiently complex that Astra is judged the better executor/auditor.

### Ultra

Ultra is not the default.

Use either:

`GPT-6.1 Sol · 울트라`

or

`GPT-6.0 Astra · 울트라`

only for exceptionally high-risk or highly complex blockers where the additional reasoning budget is justified.

### Antigravity defaults

General implementation:

`Gemini 3.8 Flash · 높음`

Structural/high-risk implementation:

`Gemini 3.1 Pro · 높음`

### Required model recommendation

Every BOA CRM implementation or audit prompt must explicitly state:

- recommended model
- recommended reasoning/effort level
- why that model is recommended
- whether a lower-cost/lower-effort option would be sufficient
- whether an alternative Sol/Astra model would be reasonable

Do not select Ultra automatically.

Usage efficiency must be considered together with quality risk.

---

## 9. Candidate Freeze

Before Codex audit, record at minimum:

- BASE SHA
- current HEAD
- branch
- candidate ID
- candidate hash/SHA where applicable
- modified paths
- evidence root
- relevant test result
- manifest

Do not mutate a candidate during an audit.

Any required implementation change creates a new candidate and a new audit.

---

## 10. Evidence Rule

Do not grant Final PASS from a stored PASS report alone.

Final approval must independently verify, as applicable:

- actual source
- actual bytes
- actual SHA256 hashes
- actual test execution
- actual runtime outputs
- actual evidence
- actual provenance

The following are insufficient as Final evidence:

- authored PASS
- manually-authored true/false
- before→after copy
- stored historical PASS
- unexecuted summary
- detached proof
- self-approval
- fabricated evidence

---

## 11. Required Prompt Binding

Every BOA CRM implementation/audit prompt must identify:

- `CANONICAL POLICY`
- `POLICY VERSION`
- `CURRENT STAGE`
- `RISK LEVEL`
- `PREVIOUS CODEX FAIL COUNT`
- `ANTIGRAVITY REMEDIATION USED`
- `CODEX IMPLEMENTATION TAKEOVER`
- `MINOR_EXCEPTION`
- candidate identity
- evidence root
- recommended model
- recommended effort
- model-selection reason
- authorized next stage on PASS
- authorized next stage on FAIL

Valid stages:

- `AG_IMPLEMENTATION_1`
- `CODEX_GATE_1`
- `AG_REMEDIATION_1`
- `CODEX_GATE_2`
- `CODEX_IMPLEMENTATION_TAKEOVER`
- `CODEX_FINAL_INDEPENDENT_GATE`

---

## 12. Default Workflow

Default Builder:

`ANTIGRAVITY`

Default Auditor:

`CODEX`

Normal Antigravity remediation allowance after first Codex FAIL:

`1`

Second Codex FAIL:

`CODEX IMPLEMENTATION TAKEOVER BY DEFAULT`

Codex implementation final approval:

`SEPARATE INDEPENDENT TASK REQUIRED`

Final truth source:

`ACTUAL SOURCE + ACTUAL TESTS + ACTUAL EVIDENCE + INDEPENDENT RECOMPUTATION`

---

## 13. One-Line Rule

Antigravity performs the initial implementation and Codex audits it independently. After the first Codex FAIL, Antigravity receives one targeted remediation attempt. If the Codex re-audit still finds a blocker, stop the repeated Antigravity repair loop and transfer implementation to Codex. After Codex implementation, perform a separate Codex Final Independent Gate before final approval.
