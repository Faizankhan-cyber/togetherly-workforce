# Phase 0: Production Database Change Gate

**Default decision:** PRODUCTION DATABASE CHANGES ARE BLOCKED until the recovery criteria below are evidenced and the project owner gives explicit approval.

This gate applies to database migrations, RLS/policy changes, trigger/function changes, role/grant changes, authentication database changes, storage policy changes, and any production operation that can alter persistent database state.

## 1. Change classes and allowed activity

| Class | Examples | Default status | Required control |
|---|---|---|---|
| Read-only production inspection | SELECT-only catalog queries, migration-ledger reads, service/backup metadata reads | **ALLOWED** | Confirm exact project ref; use read-only permissions/transactions; minimise and redact output; no secrets or personal records in logs. |
| Local/synthetic testing | Ephemeral PostgreSQL 17 CI tests, local Supabase stack, fake test accounts/data | **ALLOWED** | No production credentials or data; destructive reset is confined to disposable local services. |
| Isolated staging changes | Apply migrations or change policies on a separate staging project | **BLOCKED until target verified** | Distinct project ref and DB host, non-production credentials, data separation, owner approval, backup/rollback evidence for the staging target, and successful migration + rollback tests. |
| Production changes | Apply migrations, update RLS/grants/functions/triggers/roles, or change Auth/Storage database configuration | **BLOCKED** | Every preflight below must pass and the project owner must explicitly approve the exact operation, target and execution window. |

A Supabase preview branch is not automatically an isolated staging target. The project ref, database host, persistence, data separation, and target credentials must be independently verified before classifying it as staging.

## 2. Mandatory preflight checklist

The change owner must attach evidence for every item:

- [ ] **Target identity:** Verify the project name, exact project reference, region, environment and database host from the target project's Dashboard/Connect panel. Compare them to the change ticket. Never rely only on a project label or branch name.
- [ ] **Environment separation:** For staging, prove the ref and host are distinct from production and that no production traffic, callbacks, webhooks, jobs, or credentials can be reached from the test environment.
- [ ] **Migration history:** Capture the current live \`supabase_migrations.schema_migrations\` versions using a read-only query or \`supabase migration list\`. Compare every repository migration file and explain all missing, extra, or mismatched versions. Do not use \`supabase migration repair\` as a shortcut.
- [ ] **Baseline:** Capture relevant schema, constraints, indexes, RLS state and policies, functions, triggers, grants, extension settings, and safe aggregate integrity indicators before the change. No production row data or secrets in Git.
- [ ] **CI validation:** The relevant GitHub checks are green on the exact PR head SHA: \`validate\` and \`Database security regression tests\`. Check completion and conclusion, not merely that the checks started.
- [ ] **Database regression tests:** Relevant PostgreSQL tests pass against a disposable database. Include both permitted and denied access cases and the affected workflow paths.
- [ ] **Migration review:** A reviewer has read the full migration and rollback diff, identified affected objects and data, checked idempotency/transaction boundaries/locking/backfill behaviour, and verified required grants and policy semantics.
- [ ] **Backup or restore point:** A verified backup/restore point exists for the exact source project. Record timestamp, coverage, retention, storage controls and artifact/recovery reference. A metadata snapshot, Git commit, green CI run, or command exit code is not a backup.
- [ ] **Restore proof:** The relevant recovery path has been restored and tested in an independently verified isolated environment. Auth, Storage objects, and project configuration gaps are identified and accepted or resolved.
- [ ] **Rollback/recovery:** The rollback is reviewed, its preconditions are explicit, and it is not incorrectly represented as a full data restore. A recovery runbook and escalation contact are available.
- [ ] **Approvals:** The project owner explicitly approves the exact target ref, change/commit, execution operator, execution window, expected impact/downtime, backup reference, rollback approach, and cost impact.
- [ ] **Execution plan:** Define maintenance/write-freeze requirements, pre-change and post-change checks, monitoring, stop conditions, and the person authorised to abort.
- [ ] **Post-change verification:** Define how schema and migration history, RLS/authorization, Auth sign-in, employee access, project workflows, training submissions, evidence storage, and offboarding will be validated without exposing personal data.

Any unchecked item means the affected operation is **BLOCKED**. Do not waive a failed check because a deadline is close.

## 3. Current gate assessment (30 October 2026)

| Gate | Current evidence | Decision |
|---|---|---|
| Production target identity | \`togetherly\`, ref \`yabogftzcmqeybjnoazy\`, region \`ap-southeast-1\`; read-only inventory confirms project identity. | Complete for read-only inspection |
| Current backup / PITR | Backup inventory empty; PITR disabled; WAL-G metadata flag alone is insufficient. | **BLOCKED** |
| Verified isolated restore target | Existing preview branch is data-less, non-persistent, and exposes the same project ref as its parent; distinct DB host/ref is not verified. | **BLOCKED** |
| Migration history | Live ledger read-only query returned 20 versions. Proposed registration and employee-skills visibility migrations are not in the live ledger. Full repository-to-ledger reconciliation still required. | Partial |
| CI / database regression | Three latest PR check runs completed successfully on head \`0d292eb6487fdf5a1128a9e477b33394c20c20e2\`. | Complete for that PR head only |
| Production authorisation | No explicit authorisation for a production database operation has been recorded. | **BLOCKED** |
| Rollback / recovery | Existing registration rollback is function-only; it is not a data backup or whole-project restore. | Partial |

**Current decision: production migrations, RLS policy changes, trigger/function/role/grant changes, and destructive SQL are BLOCKED.** Continue only read-only inspection and local/synthetic tests until the recovery requirements pass.

## 4. Production execution protocol (only after all gates pass)

1. Re-fetch the PR head SHA, current production project ref/region, migration ledger, backup/recovery point and branch protection status immediately before the window.
2. Confirm every required status check passed for the exact reviewed commit and the required pull-request review is recorded.
3. Have the project owner repeat explicit approval in the change record, including any downtime/cost/data-loss implications.
4. Take or identify the final verified backup/recovery point and record its immutable reference.
5. Apply only the reviewed migration using the approved operator and exact target connection. Do not run an automated production migration from GitHub Actions.
6. Stop immediately on an unexpected SQL error, lock timeout, schema difference, policy behaviour, or data-integrity discrepancy. Do not continue to subsequent migrations.
7. Run the pre-defined post-deployment checks and observe the application for the agreed monitoring window.
8. If validation fails, follow the approved migration-specific rollback or restore runbook. Do not improvise broad grants, disable RLS, or restore over production without a separate explicit restore authorisation.
9. Record command names, timestamps, exit codes, migration versions, validation output and any deviations without logging secrets or personal data.

## 5. CI/CD restrictions

GitHub Actions may run lint, type-check, dependency audit, build, and disposable PostgreSQL regression tests. It must not automatically connect to or mutate the production database as part of Phase 0.

No workflow in this phase may:
- run \`supabase db push\`, \`supabase migration up\`, \`supabase migration repair\`, or equivalent against production;
- restore a backup over production;
- change production RLS, grants, roles, functions, triggers, Auth or Storage configuration;
- enable paid backup/PITR features or create billable projects/resources.

Any future production deployment process must be separately reviewed, least-privileged, explicitly authorised, and consistent with this gate.

## 6. Completion and exception policy

The gate becomes eligible for approval only after the Phase 0 runbook completion criteria are met. An exception requires written approval from the project owner and security owner, a documented reason, named risk owner, exact limited scope, expiry, compensating controls and recovery reference. An exception cannot turn an unverified backup or untested restore into evidence of recoverability.

See [phase-0-backup-recovery-runbook.md](./phase-0-backup-recovery-runbook.md) and [phase-0-current-recheck-20261030.md](./phase-0-current-recheck-20261030.md).
