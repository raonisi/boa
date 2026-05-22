# PR Final Report Template

Use this format for BOA CRM implementation, hotfix, documentation, and release-readiness handoffs. Keep empty sections short rather than inventing detail.

```text
[BOA CRM PR SUMMARY]

1. Final Verdict
- PASS / NEEDS WORK / HOLD / CONDITIONAL PILOT

2. Scope
- Included:
- Excluded:

3. Changed Files
- path: why it changed

4. What Was Verified
- Code paths:
- Role paths:
- UI routes:
- API procedures:
- External systems checked:

5. Test Results
- command: pass/fail
- key failure line, if any:

6. Evidence
- Screenshots:
- Logs:
- File/line references:
- Reproduction steps:

7. P0/P1/P2/P3 Issues
- P0:
- P1:
- P2:
- P3:

8. RBAC / Security Impact
- Role impact:
- Customer data exposure impact:
- Token/secret/logging impact:

9. DB / Migration Impact
- Schema changed:
- Migration required:
- Rollback expectation:

10. UI / UX Impact
- Desktop:
- Mobile:
- Accessibility:
- Empty/loading/error/forbidden states:

11. Deployment Risk
- GitHub state:
- Railway state:
- Env vars/secrets:
- Rollback:

12. Remaining Work
- Unverified external systems:
- Follow-up tasks:
- Monitoring items:

13. Recommended Next Step
- One concrete next action:
```
