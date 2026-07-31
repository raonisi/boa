# BOA CRM Production Deployment Gate

Production promotion is fail-closed. Railway GitHub auto-deploy must remain disabled, and this workflow must remain unarmed until every external setting below is verified.

## Deployment path map

| Path                       | Present before PR-C                  | Can deploy production | Final policy                                            |
| -------------------------- | ------------------------------------ | --------------------- | ------------------------------------------------------- |
| Railway GitHub auto-deploy | Yes                                  | Historically yes      | Keep disabled                                           |
| GitHub Actions             | Quality Gate only                    | No                    | Add an unarmed exact-SHA gate                           |
| Railway CLI                | No repository workflow or local link | Not configured        | Use only from the protected workflow after manual setup |
| Deploy Hook                | Not found                            | No known path         | Do not add                                              |
| Railway UI                 | Yes                                  | Yes                   | Emergency operator path only; current `main` only       |

GitHub deployment history identifies the connected environment as `handsome-sparkle / production`, but that label is not sufficient proof of the Railway project, service, environment IDs, or service settings. Do not copy it into workflow configuration as a guessed identifier.

## Code-enforced gate

`.github/workflows/production-deploy.yml` runs after `Quality Gate` completes and requires all of the following:

- source event is a `push` to `main` in `raonisi/boa`, not a PR or fork;
- the candidate is the current `main` tip and the exact checked-out SHA;
- `check`, `unit-test`, `coverage`, `build`, `bundle-budget`, `e2e-critical`, and `accessibility` each completed successfully;
- `PRODUCTION_DEPLOY_ENABLED` is exactly `true`;
- the queued job rechecks `main` immediately before deployment;
- production jobs are serialized with `boa-production-deploy` and are not cancelled mid-deploy;
- the protected Railway token and three validated Railway IDs exist;
- `RAILWAY_PRE_DEPLOY_VERIFIED` is exactly `true`.

The CLI uploads the exact checkout. Railway documents `RAILWAY_GIT_COMMIT_SHA` only for GitHub-triggered deployments, so the workflow stamps the validated 40-character candidate SHA into `server/generated/releaseIdentity.ts` before upload and verifies that generated source byte-for-byte. Production does not fall back to a short SHA or an environment value when the stamp is absent.

Before upload, the pinned Railway CLI 5.28.0 lists deployments with the allowlisted project, environment, and service UUIDs passed explicitly. This read-only list is the Project Token preflight: authentication, context access, JSON parsing, and deployment schema validation must all succeed before upload. The Quality Gate installs the same pinned CLI without a token and verifies from `--help` that both `deployment list` and `up` support the required explicit-ID options. No `railway link`, `railway status`, workspace lookup, or account token is used. The preflight snapshot checks whether the candidate is already live with a latest successful Railway deployment. An exact match becomes an `already-deployed` no-op. A latest deployment that is already in progress blocks a competing upload for manual review. Otherwise, the pinned CLI performs an attached `railway up` with the same explicit project, service, and environment UUIDs and without `--ci` or `--json`. The gate then lists the same context again, requires exactly one new deployment ID created after upload began, and tracks only that ID to terminal `SUCCESS`. Zero or multiple new IDs, an unknown status, a failure status, or a timeout fails closed. Only after `SUCCESS` does health verification require three consecutive JSON responses from `/api/health` and `/api/version`, HTTP 200, the production environment label, identical 40-character `commitSha` values, and the expected display-only `commitShort`.

Railway build, Pre-Deploy, and runtime output stays in Railway/GitHub job logs. If the CLI gate fails, the workflow uploads a one-day diagnostic artifact containing only the bounded stage, safe error code, numeric exit code, candidate SHA, upload-attempt/completion flags, whether the exit code is known, the bounded deployment-registration state, and whether an exact deployment ID was tracked. After upload begins, a list failure records registration as `unknown` and requires Railway UI inspection; it never reports a false negative, retries the upload, or treats existing health as success. Raw CLI stderr, environment variables, URLs, credentials, and tokens are never included.

## Required GitHub manual settings

Create a protected GitHub environment named `production`. Keep these values out of repository files and PR text.

Environment secret:

- `RAILWAY_TOKEN`: a production-environment project token, not an account-wide token.

Repository variable (the secret-free eligibility job must read this before the `production` environment is entered):

- `PRODUCTION_DEPLOY_ENABLED=false` initially;

Production environment variables:

- `RAILWAY_PRE_DEPLOY_VERIFIED=false` until the dashboard is inspected;
- `RAILWAY_PROJECT_ID`;
- `RAILWAY_SERVICE_ID` for the BOA web service only;
- `RAILWAY_ENVIRONMENT_ID` for production only.

Recommended environment protection requires an authorized reviewer before the `deploy-production` job can access the token. Branch protection must continue requiring the seven Quality Gate jobs.

## Required Railway manual verification

In the BOA web service's production settings, verify and record:

- GitHub auto-deploy is disabled;
- the linked repository and branch are `raonisi/boa` and `main`;
- Build Command is `pnpm install && pnpm build`;
- Pre-Deploy Command is exactly `pnpm db:migrate`;
- a failed Pre-Deploy stops the application release;
- Start Command is `pnpm start`;
- `https://raonisis.kr` belongs to this service and environment.

Only after that review may `RAILWAY_PRE_DEPLOY_VERIFIED` become `true`. Railway CLI deployment listing does not independently expose the configured Pre-Deploy command, so this variable remains an explicit operator-attested configuration ratchet rather than inferred proof. This repository does not run `pnpm db:migrate` from the GitHub runner; Railway must run it once as the configured Pre-Deploy command. Railway documents that a failed Pre-Deploy command prevents the deployment from proceeding, and the gate additionally requires the exact new deployment ID to reach `SUCCESS` before health checks.

## Activation sequence

1. Review and merge PR-C with `PRODUCTION_DEPLOY_ENABLED=false`.
2. Confirm the merged main Quality Gate passed and the production workflow did not deploy.
3. Complete the GitHub and Railway checks above.
4. Obtain explicit operator approval.
5. Set `PRODUCTION_DEPLOY_ENABLED=true`.
6. Trigger a new current-main Quality Gate run; do not reuse an old or PR run.
7. Confirm the exact new Railway deployment ID reached `SUCCESS`, Railway Pre-Deploy did not fail, and both health endpoints report the exact full SHA.

Until step 7 succeeds, the production gate is not operationally complete.

## Emergency lock and rollback

Set `PRODUCTION_DEPLOY_ENABLED=false` first and keep Railway auto-deploy disabled. Do not automatically redeploy an older artifact or roll back database migrations. Inspect any running workflow and Railway deployment, then choose an application rollback compatible with the already-applied schema.

The privileged production workflow pins `actions/checkout` and `actions/setup-node` to full upstream commit SHAs with their major-version intent documented inline. Update those pins through a reviewed PR after validating the new official action commits; do not replace them with mutable tags in the production workflow.
