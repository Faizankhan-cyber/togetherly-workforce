# Phase 0: Current Live Recheck

**Captured:** 30 October 2026 (UTC)  
**Method:** Read-only GitHub and Supabase integration calls, plus a read-only PostgreSQL migration-ledger query. No production data, schema, policy, Auth, Storage, project, or billing settings were modified.

This document supersedes earlier statements in the Phase 0 baseline/addendum wherever the live facts below differ. Older snapshots remain useful as historical evidence but must not be treated as current configuration.

## 1. Production Supabase project

| Field | Current observation |
|---|---|
| Organization | \`faizankhan-cyber's projects\` |
| Organization plan | \`free\` |
| Project name | \`togetherly\` |
| Project ref | \`yabogftzcmqeybjnoazy\` |
| Region | \`ap-southeast-1\` |
| Postgres | 17.11.0.003 |
| Project status | \`ACTIVE_HEALTHY\` |
| Reported service health | 8 services, all \`ACTIVE_HEALTHY\` |
| Project inventory | One project visible to the connected account |

A healthy service state does not establish backup or restore readiness.

## 2. Backup and PITR inventory

The current backup inventory returned:

- \`backups: []\` (zero backup records)
- \`pitr_enabled: false\`
- \`walg_enabled: true\`
- Region: \`ap-southeast-1\`

The WAL-G flag is configuration metadata only. No backup artifact, timestamp, retention, or PITR restore point was returned. Therefore the current status remains **no verified recoverable backup and no PITR restore point**.

The connected organization is on the Free plan. Supabase's current public documentation describes automated daily backups for Pro, Team and Enterprise projects, and recommends CLI exports with off-site storage for Free projects. PITR is a paid add-on for paid-plan organizations with at least Small compute. No plan change, paid add-on, or billing action was requested or performed.

## 3. Preview branch isolation

The branch inventory returned one preview branch:

| Field | Returned value |
|---|---|
| Name | \`security-remediation-test\` |
| Git branch | \`security/remediation-v1\` |
| Parent project ref | \`yabogftzcmqeybjnoazy\` |
| Exposed \`project_ref\` | \`yabogftzcmqeybjnoazy\` |
| \`with_data\` | \`false\` |
| \`persistent\` | \`false\` |
| Branch status | \`FUNCTIONS_DEPLOYED\` |
| Preview status | \`ACTIVE_HEALTHY\` |

The available connector did not return a distinct database project reference or database hostname for this branch. Its exposed project ref equals the parent production ref. Accordingly, branch isolation is **not proven** and it must not be used as a restore target. Do not guess a branch ref or reuse the branch UUID as a project ref. A human operator can use the official Supabase CLI branch-details command to inspect it, but all connection output must be treated as sensitive.

No second Supabase project was visible to the connected account at recheck.

## 4. Migration ledger

A read-only query against \`supabase_migrations.schema_migrations\` returned exactly 20 live versions:

\`\`\`text
20261025082656
20261025083033
20261025084254
20261025170752
20261025172015
20261025172552
20261025173049
20261025173521
20261025175714
20261026051827
20261027150203
20261027184118
20261028020506
20261028022149
20261028080412
20261028113644
20261028113718
20261028135853
20261028135907
20261028151337
\`\`\`

The proposed rejected-registration migration \`20261028_reapply_rejected_registration.sql\` and employee-skills visibility migration \`20261030100000_employee_skills_visibility.sql\` exist on the remediation branch but are not recorded in the live ledger. They have not been applied to production. The complete local-file-to-ledger comparison remains a pre-migration requirement.

## 5. GitHub / PR #25

- Repository: \`Faizankhan-cyber/togetherly-workforce\`
- Production base branch: \`main\`, HEAD \`50160172f69c822f1947ee57c6f198d3df046cd2\`
- Remediation branch: \`security/remediation-v1\`, HEAD \`0d292eb6487fdf5a1128a9e477b33394c20c20e2\`
- PR #25 remains **open and unmerged**: [Start Togetherly security remediation and test rejected-registration recovery](https://github.com/Faizankhan-cyber/togetherly-workforce/pull/25)
- The comparison reports 8 commits ahead and 0 behind main, with 24 changed files before this Phase 0 documentation update.
- The latest three PR checks completed successfully on the verified head: \`Vercel Preview Comments\`, \`validate\`, and \`Database security regression tests\`. These are CI/preview results, not production database recovery evidence.
- \`main\` is protected. The current rules require the \`validate\` and \`Database security regression tests\` status checks, one approving review, stale-review dismissal, approval of the latest push, conversation resolution and linear history. Admin enforcement is enabled; force-push and deletion are disabled.
- \`security/remediation-v1\` is not protected. Do not force-push.
- The latest branch workflow uses Node 22 and \`npm ci\`, followed by lint, high-severity npm audit, type-check and production build. A separate PostgreSQL 17 service job runs the database regression suite.

Earlier baseline text that says \`main\` has no branch protection and that no preview branch exists is historical and stale. The previous live-verification addendum's claim that the preview branch is an isolated database is not supported by the current branch metadata and must not be relied upon until distinct target details are verified.

## 6. Repository backup-file hygiene

The prior root \`.gitignore\` ignored \`node_modules\`, \`.env\`, and Vite timestamped config files but did not explicitly ignore common private backup directories or dump/archive extensions. This Phase 0 update adds explicit ignore rules for root backup directories and database dump/archive artifacts.

Never commit production database dumps, Auth exports, Storage object files, backup credentials, or connection strings. The metadata-only schema snapshot already in the PR is not a data backup.

## 7. Findings and current decisions

| Finding | Observation | Confidence | Decision |
|---|---|---|---|
| P0-R1 | No backup records and PITR disabled. | High | **BLOCK** production database changes. |
| P0-R2 | Organization plan is Free. | High | Do not assume managed daily backups or PITR; evaluate CLI/off-site backup or obtain separate paid-plan approval. |
| P0-R3 | Preview branch does not expose a distinct target ref/host and is data-less/non-persistent. | High for returned fields; isolation unknown | **BLOCK** restore drill to this branch. |
| P0-R4 | 20 live migration versions returned; two remediation migrations are absent. | High | Keep production migrations unapplied pending full history comparison and recovery test. |
| P0-R5 | Backup/restore permissions for named operators were not exposed. | Unknown | Project owner must verify roles in Dashboard. |
| P0-R6 | No verified backup destination has been selected. | High | Owner approval and secure storage decision required. |

## 8. Actions performed and not performed

**Performed:** read-only project/organization inventory, backup inventory, database branch inventory, service-health read, migration-ledger SELECT, PR/branch/check inspection, and repository-file inspection.

**Not performed:** no backup creation, no dump/export, no object copy, no PITR enablement, no plan upgrade, no project/branch creation, no restore, no migration, no production SQL write, no RLS/policy/function/trigger/role/grant change, no Auth/Storage change, no production deploy, and no PR merge.

**Current Phase 0 decision:** PARTIALLY COMPLETE. Production migrations and database security changes remain BLOCKED until a supported backup/recovery path and isolated restore test are demonstrated and approved.

## 9. References

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project)
- [Supabase Storage object downloads](https://supabase.com/docs/guides/storage/management/download-objects)
