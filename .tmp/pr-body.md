## Summary

- Apply server-side mobile customer/contract search filtering after RBAC-scoped list fetch (P1).
- Clear Flutter analyze info lints and stabilize widget tests (bounded `pump` instead of unbounded `pumpAndSettle`).
- Add unit/integration tests for mobile search filters and routes.

## P1 mobile search

- **Customers:** `search` query forwarded to scoped `caller.customers.list({ search })`, then paginated.
- **Contracts:** scoped `caller.contracts.list` result filtered in-memory (`productName`, `company`, `productGroup`, `contractStatus`, `paymentStatus`), then paginated.
- No API payload changes; RBAC/scope preserved.

## Flutter gates

- `flutter analyze`: exit 0 (No issues found).
- `flutter test`: Windows local runner fails with `Could not prepare isolate` (environmental). Widget tests stabilized; verify on Linux CI or macOS for full PASS evidence.

## Root verification

- `pnpm.cmd check` PASS
- `pnpm.cmd test` PASS (455 tests, includes `mobileSearchFilters` + `mobileRoutes` search tests)
- `pnpm.cmd build` PASS

## Test plan

- [ ] Mobile global search returns scoped customers matching name/phone/status
- [ ] Mobile global search returns scoped contracts matching product/company/status
- [ ] Empty search preserves prior pagination behavior
- [ ] Overlong search (>100 chars) returns 400
- [ ] `flutter analyze` exit 0
- [ ] `flutter test` PASS on Linux CI / non-Windows runner
- [ ] Confirm no secrets/APK/keystore/google-services staged

## Constraints preserved

- No DB schema/migration changes
- No RBAC weakening or scope bypass
- No production data used in tests
