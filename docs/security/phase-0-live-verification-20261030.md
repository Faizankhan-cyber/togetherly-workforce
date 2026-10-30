# Phase 0: Live Verification Addendum

**Captured:** 30 October 2026, 09:59 UTC  
**Scope:** Read-only Supabase and GitHub inspections; one documentation-only Git commit on `security/remediation-v1`.  
**Decision:** **PARTIALLY COMPLETE**. Production database changes remain **BLOCKED**.

This addendum records a fresh recheck and supplements (does not replace) `phase-0-current-recheck-20261030.md`. The earlier recheck remains valid for the findings it actually verified; this addendum records the additional live evidence below. No production write was performed.

## 1. Supabase production identity and health

| Check | Current result | Evidence / limits |
|---|---|---|
| Project | `togetherly` | Read-only project and project-inventory calls |
| Project ref | `yabogftzcmqeybjnoazy` | Exact ref returned by Supabase |
| Region | `ap-southeast-1` | Project metadata and backup inventory |
| Database | PostgreSQL 17.11.0.003 | Project metadata |
| Project status | `ACTIVE_HEALTHY` | Project metadata |
| Services | 8 returned; all `ACTIVE_HEALTHY` | Per-service health response |
| Database probe | One row returned; `current_database()` = `postgres`; PostgreSQL 17.11 | Read-only `SELECT current_timestamp, current_database(), version()` at 2026-10-30 09:57:19 UTC |
| Read-only mode | `enabled=false`, `override_enabled=false` | Read-only mode status endpoint. This is not permission to make changes. |
| Organization plan | `free` | Existing verified project/organization metadata; no plan-setting change performed |

A healthy service and successful SELECT show only that the database is reachable. They do not prove recoverability.

## 2. Backup and PITR

A fresh call to the Supabase backup inventory endpoint at approximately 09:58 UTC returned:

- `backups: []` (zero backup records returned)
- `pitr_enabled: false`
- `walg_enabled: true`
- region `ap-southeast-1`

The WAL-G flag is metadata and is not a backup artifact, timestamp, retention record, or restore point. No named backup, last-success timestamp, retention, or PITR restore window was exposed. Current evidence therefore remains **no verified recoverable backup and no PITR restore point**.

No backup was created, no export was run, and no paid option or billable resource was enabled. Do not upgrade the Free plan or enable PITR without separate explicit owner approval and cost review.

## 3. Restore-environment inventory

The connected account sees one Supabase project. It also sees one preview branch with:

- name `security-remediation-test`
- parent project ref `yabogftzcmqeybjnoazy`
- exposed `project_ref` also `yabogftzcmqeybjnoazy`
- `with_data=false`
- `persistent=false`
- preview status `ACTIVE_HEALTHY`

The branch inventory did not expose a distinct database project reference or database hostname. Do **not** infer isolation from its Git branch name, branch UUID, or healthy status. This branch is **not an approved restore target**. No restore was attempted. A human owner must establish a disposable target with a distinct verified project ref and database host, no production traffic/integrations, and test-only credentials before any restore drill.

## 4. Migration history

The read-only Supabase migration-history endpoint returned 20 applied migration versions. The full ordered version list is recorded in `phase-0-current-recheck-20261030.md` and remains unchanged in this recheck.

The following two files exist on `security/remediation-v1` but their versions are not in the live 20-entry ledger:

- `supabase/migrations/20261028_reapply_rejected_registration.sql`
- `supabase/migrations/20261030100000_employee_skills_visibility.sql` (version `20261030100000`)

They are **not recorded as applied** by the migration ledger. Do not run either migration or repair the ledger during Phase 0. The complete repository-file-to-ledger comparison and migration review remain required before Phase 1.

## 5. GitHub state

| Check | Result |
|---|---|
| Repository | `Faizankhan-cyber/togetherly-workforce` |
| Remediation branch | `security/remediation-v1` |
| Branch HEAD at inspection start | `bf5d408ca29876b5a8f2b54b66ace17992e201ad` |
| PR #25 | Open, unmerged, base `main` |
| PR changed files | 28 |
| Branch comparison | 12 commits ahead, 0 behind `main` |
| Remediation branch protection | Not protected; do not force-push |
| `main` protection | Enabled; admin enforcement enabled; force-push/deletion disabled |
| Required checks on `main` | `validate` and `Database security regression tests` |
| Required review controls | One approval, dismiss stale reviews, latest-push approval, conversation resolution, linear history |

The latest workflow run inspected for the branch HEAD was run `41036224101`, workflow `Validate Togetherly`, triggered by `pull_request`, completed successfully at 2026-10-30 09:50:04 UTC. Three check runs were successful: `Vercel Preview Comments`, `validate`, and `Database security regression tests`. The database job used a disposable PostgreSQL 17 service. These checks are not evidence of a production backup or restore.

The repository exposes one active workflow, `.github/workflows/validate.yml`. It runs Node 22 dependency installation, lint, high-severity npm audit, type-check, production build, and a database regression job on a disposable PostgreSQL 17 service. No production migration job was observed in this workflow.

Repository security settings show secret scanning enabled and push protection enabled. The secret-scanning endpoint returned no alerts. Code scanning returned an empty alert list with an explicit message that code scanning has **not been run**; this must not be represented as a clean code scan. No code-scanning setting or workflow was changed.

## 6. Repository hygiene review

The current `.gitignore` explicitly excludes `/backups/`, `/backup/`, `/.private-backups/`, `/private-backups/`, `*.dump`, `*.dump.gz`, `*.backup`, `*.backup.gz`, and `*.sql.gz`, in addition to `.env` and `node_modules`. The current validation workflow has read-only `contents: read` permissions and no production database credentials or production migration step in its inspected YAML.

This is a configuration review, not a local `git status`, `git check-ignore`, or repository secret-scan execution. Those commands were not run in a local checkout during this inspection.

## 7. Findings and actions

| ID | Observation | Risk | Confidence | Required action |
|---|---|---|---|---|
| P0-L1 | Backup inventory empty; PITR disabled; WAL-G flag is not recovery proof | Critical | High | Obtain/produce a verified backup by an approved method |
| P0-L2 | Preview branch has no distinct exposed target ref/host and is non-persistent/data-less | Critical | High for returned fields; isolation unknown | Do not restore there; establish isolated target |
| P0-L3 | 20 applied migration versions; two remediation migrations absent | High | High | Complete file-to-ledger reconciliation; keep production migrations blocked |
| P0-L4 | No backup/restore artifact access permissions were exposed | High | Unknown | Owner to verify authorised backup and restore operators in Dashboard |
| P0-L5 | One active validation workflow; current branch checks pass | Informational | High | Continue CI; do not interpret as recovery proof |
| P0-L6 | Secret scanning and push protection enabled; no secret alerts; code scanning not run | Medium | High for returned tool results | Treat code scanning as not assessed; any enablement is a separately reviewed repo change |
| P0-L7 | `.gitignore` excludes common backup directories and dump/archive files | Medium | High for file content; runtime ignore test not executed | Run local `git check-ignore` and status checks before any export |

**Actions performed:** read-only project/org inventory, backup inventory, branch inventory, service health, read-only mode status, one PostgreSQL SELECT probe, migration history read, repository/branch/PR/CI/protection/security-setting inspection, and read-only file review.

**Not performed:** no production data/schema/policy/function/trigger/role/grant/Auth/Storage/settings change; no migration or ledger repair; no database export or backup creation; no PITR or plan change; no branch/project creation; no restore; no production deploy; no PR merge; no workflow or security-setting change.

## 8. Remaining blockers and Phase 1 gate

Phase 0 is **PARTIALLY COMPLETE**, not complete. The following owner/operator actions remain:

1. Confirm the organisation plan and backup/restore operator permissions in the Supabase Dashboard.
2. Select an encrypted, private, off-project storage destination and approve retention, access and cost.
3. Create a supported logical export (or obtain an approved recoverable managed backup) using secure credential handling; separately address Auth users, Storage object files, bucket metadata, Edge Functions, secrets and project configuration.
4. Verify artifact integrity and private storage, then restore into a demonstrably isolated non-production project with a distinct reference and hostname.
5. Validate schema, migration history, constraints/indexes, RLS/policies, functions/triggers, roles/grants, non-sensitive counts and safe application compatibility.
6. Complete the full repository migration-file-to-live-ledger comparison and review the exact production change and rollback plan.

Until those requirements pass and the project owner explicitly authorises a specific production operation, **Phase 1 production migrations, RLS changes, trigger/function/role/grant changes and destructive SQL remain BLOCKED**. Local/synthetic tests and read-only inspection may continue.

## 9. References and evidence locations

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project)
- [Phase 0 backup/recovery runbook](./phase-0-backup-recovery-runbook.md)
- [Phase 0 production change gate](./phase-0-production-change-gate.md)
- [Phase 0 current recheck](./phase-0-current-recheck-20261030.md)
- [PR #25](https://github.com/Faizankhan-cyber/togetherly-workforce/pull/25)
- [Workflow run 41036224101](https://github.com/Faizankhan-cyber/togetherly-workforce/actions/runs/41036224101)

This document intentionally contains no credentials, connection strings, backup files, personal records, or production data.
