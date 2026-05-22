# Database Migration Safety

Use this standard before editing schema, migrations, indexes, seeds, or production data paths.

## Migration Risk Levels

Low:
- Add nullable column.
- Add safe index.
- Add dev/test lookup data.
- Document schema behavior.

Medium:
- Add non-null column with default.
- Backfill small bounded data.
- Add unique constraint after duplicate check.
- Change query behavior across role scopes.

High:
- Drop or rename column.
- Change enum semantics.
- Backfill large production tables.
- Modify delete/restore lifecycle.
- Change customer/contract ownership semantics.

Stop and report:
- Production reset, drop, or truncate.
- Manual production hard delete.
- Destructive migration without rollback or mitigation.
- Unknown production schema state.
- Migration that may expose customer data or weaken RBAC.

## Migration Plan Requirements

Every migration plan should state:
- forward change
- rollback or mitigation
- affected tables
- expected data volume
- index impact
- whether old app versions remain compatible

If rollback is not practical, say so before implementation.

## Destructive Change Warnings

Do not:
- casually drop customer, contract, consultation, schedule, or log data
- delete `activity_logs`
- remove audit evidence
- rewrite production history to make a test pass
- run destructive production commands from a local debugging session

## Index and Performance Checks

Check:
- joins on foreign keys
- list filters used by dashboards and mobile views
- notification and push log queries
- customer assignment filters
- schedule date ranges
- export/import queries

Flag:
- N+1 query risk
- unbounded queries
- missing pagination
- full scans on large operational tables

## Seed and Test Data

- Use safe fixtures only.
- Do not use real customer information.
- Do not commit production CSVs.
- Do not make test data look like real resident registration, policy, or credential data.

## Production DB Safety

Before touching production, confirm:
- environment
- backup/restore expectation
- migration command
- rollback or mitigation
- owner approval for high-risk changes

## Stop Conditions

Stop and report before changing when:
- schema state differs from local
- migration requires data deletion
- role scope depends on changed columns
- downtime or lock risk is unclear
- Railway/Aiven/live DB state cannot be verified
