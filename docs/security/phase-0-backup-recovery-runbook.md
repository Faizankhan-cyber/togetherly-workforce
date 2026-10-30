# Phase 0: Backup, Recovery, and Disaster-Recovery Runbook

**Status:** PARTIALLY COMPLETE. This is an actionable runbook, not evidence that a backup or restore has already been performed.  
**Last verified:** 30 October 2026 (UTC). See [phase-0-current-recheck-20261030.md](./phase-0-current-recheck-20261030.md) for the live evidence and known differences from earlier snapshots.

## 1. Scope and recovery objectives

This runbook covers the Togetherly Workforce production Supabase database and the supporting services needed to restore the application safely. It separates database recovery from Auth, Storage objects, Edge Functions, secrets, and project configuration because a database dump alone does not recover the whole Supabase project.

Production project identity, confirmed read-only:

| Attribute | Verified value |
|---|---|
| Project name | \`togetherly\` |
| Project reference | \`yabogftzcmqeybjnoazy\` |
| Region | \`ap-southeast-1\` |
| Postgres | 17.11.0.003 |
| Project status | \`ACTIVE_HEALTHY\` |
| Organization plan | \`free\` |
| Backups returned by the project backup inventory | 0 |
| PITR | Disabled |
| WAL-G metadata flag | Enabled; this is not evidence of an available backup or restore point |

**Do not use a project name alone to identify a target.** Before a database command, independently compare the Dashboard project reference and region with the approved change record. For a restore, verify the target project reference and database host from that target project's own Connect panel. Never infer a target from a branch label, Git branch, URL fragment, UUID, or this document.

## 2. Current baseline and findings

| Finding | Observation | Evidence / confidence | Risk |
|---|---|---|---|
| P0-01 | The connected Supabase organization is on the Free plan. | Organization metadata; verified. | High |
| P0-02 | The live backup inventory returned an empty list and PITR is disabled. | Current project backup inventory; verified at recheck. | Critical |
| P0-03 | WAL-G is reported enabled, but no backup record or recovery point is exposed. | Backup inventory metadata; verified. Not a proof of backup coverage. | High |
| P0-04 | A branch called \`security-remediation-test\` is listed with \`with_data=false\`, \`persistent=false\`, and the same exposed \`project_ref\` as its parent. A distinct database ref/host was not returned. | Branch metadata; verified. Isolation is unverified. | Critical |
| P0-05 | The live \`supabase_migrations.schema_migrations\` ledger contains 20 versions. | Read-only query; verified. The two remediation migrations described below are not in this ledger. | High |
| P0-06 | No separate Supabase project is visible to the connected account. | Project inventory; verified for the connected account only. | High |
| P0-07 | Who can create backups, initiate restores, access backup artifacts, or change billing was not exposed by the available read-only integration. | Unknown; requires Dashboard owner review. | Medium |
| P0-08 | The existing schema/security JSON snapshot is metadata-only, not a recoverable database backup. | Repository artifact inspection; verified. | Critical |

At the recheck, the two remediation migrations present in the feature branch but absent from the live 20-version ledger were:

- \`20261028_reapply_rejected_registration.sql\`
- \`20261030100000_employee_skills_visibility.sql\`

Do not use \`supabase migration repair\` to make the ledger appear aligned. First compare every repository migration with the live ledger and determine why any entries differ. A migration-history edit is a database change.

The current GitHub PR and branch details, including the corrected main-branch protection state, are recorded in the current recheck document. GitHub CI success is not evidence of a database backup or restore.

## 3. Backup and recovery strategy

### 3.1 Strategy comparison

| Strategy | Coverage | Important exclusions / limitations | Current RPO / RTO |
|---|---|---|---|
| Supabase-managed daily physical backups | Database schema and data; platform restore can include Auth user data when restoring to a new project. Retention depends on paid plan. | Does not include Storage object files. Custom role passwords and project-level settings require separate work. | Not available in the current verified Free-plan state. |
| Supabase PITR | Database recovery to a selected point with seconds-level time granularity while a usable recovery window exists. | Paid-plan add-on; requires at least Small compute. Restore makes the target project inaccessible during recovery. Storage objects and project configuration still need separate recovery. | Disabled; no current restore points. |
| Supabase CLI logical dump | Schema, application data, and roles when explicitly exported. Migration history requires a separate dump. | CLI dump excludes managed \`auth\`, \`storage\`, and extension schemas. It does not include Storage file contents or provide a complete Auth-user recovery. | Proposed database-only RPO: 24 hours for a successfully completed daily export. RTO unmeasured. |
| Storage object export | Actual files from private buckets, copied separately using supported Supabase Storage CLI or an S3-compatible client. | Does not by itself restore database metadata, bucket configuration, Auth, or application database state. | Proposed object RPO: 24 hours if a daily copy is implemented and verified. RTO unmeasured. |
| Restore to a new Supabase project | Supabase documents database schema, data, indexes, roles/permissions/users, Auth user data, and encryption root key as transferred. | Paid plans and source physical backups required. Storage objects/settings, Edge Functions, Auth settings/API keys, Realtime settings, extensions and database settings need manual reconfiguration. New-project costs must be reviewed. | Not currently available; no cost or restore action approved. |

Supabase documentation states that daily managed backups are provided for Pro, Team, and Enterprise projects, with 7, 14, and up to 30 days of daily retention respectively. Free projects are directed to use Supabase CLI exports and off-site backups. PITR is a paid add-on for paid-plan organizations with at least Small compute. The current connected organization is Free and its backup inventory is empty. No upgrade or add-on is authorized by this runbook.

Current documented PITR pricing (USD, subject to change) is approximately $0.137/hour for 7-day retention (~$100/month), $0.274/hour for 14-day retention (~$200/month), and $0.55/hour for 28-day retention (~$400/month). These are reference prices only, not an approval or quote. Confirm current billing in the Dashboard before any request to enable PITR.

### 3.2 Minimum viable plan on the current Free plan

The lowest-cost practical starting point is a scheduled, encrypted, off-project logical database export plus a separately verified Storage-object copy and a documented Auth recovery approach. This is **not yet a complete application recovery plan** because the Supabase CLI logical dump excludes the managed Auth schema and therefore does not, by itself, preserve Auth users and credentials.

Before calling this strategy adequate, the project owner must decide and test one supported Auth recovery route. Options to evaluate with Supabase are a paid physical-backup restore-to-new-project flow, or a documented Auth continuity process that explicitly accepts the limitations of user re-provisioning. Do not directly edit or bulk-import Supabase-managed Auth tables as a workaround.

The export destination must be outside this Git repository and outside the production Supabase project, encrypted at rest and in transit, access-controlled to named recovery operators, versioned, and protected from accidental deletion. The exact storage provider, region, retention, encryption mechanism, and authorised members have not yet been selected or verified. Do not place a production dump in Git, a public bucket, a shared desktop folder, or an unencrypted cloud drive.

### 3.3 Proposed objectives, not guarantees

- **Current RPO:** unknown/unbounded. No verified backup artifact or PITR restore point exists in the current inventory.
- **Current RTO:** unknown. No restore has been performed.
- **Proposed database-only RPO:** at most 24 hours, conditional on a successful daily logical export, off-project upload, and integrity verification.
- **Proposed database-only RTO:** an initial planning target of 4 hours from authorisation to a validated isolated database. This is untested and must be replaced with the measured result of a restore drill.
- **Auth, Storage files, Edge Functions, secrets, and complete application RTO:** unknown until their recovery paths are independently tested.

PITR can provide finer-than-daily recovery when enabled and when the required recovery points are available, but it is not enabled on this project. No SLA is implied by these proposed objectives.

## 4. Backup creation procedure (human operator required)

**Not executed.** No approved backup destination or database connection was available through the read-only integration. The following is a documented procedure based on the Supabase CLI, not a claim that files exist.

### 4.1 Preconditions

1. Obtain explicit approval from the project owner for a production read-only export, the data classification, destination, retention, and operators.
2. Confirm the current source project in the Supabase Dashboard: ref \`yabogftzcmqeybjnoazy\`, region \`ap-southeast-1\`. Stop if either differs.
3. Review the current Supabase plan and any potential costs. Do not upgrade the plan, enable PITR, enable S3 protocol, or create billable resources without separate explicit approval.
4. Select an encrypted, private off-project backup destination and test its access controls before exporting.
5. Install a current supported Supabase CLI, Docker, and PostgreSQL client on a trusted operator workstation. The Supabase CLI \`db dump\` command uses Docker.
6. Obtain a database connection string from the verified source project's Connect panel. Keep it in a password manager or protected process environment. Never put it in command history, a script, a ticket, a Git file, or terminal output.
7. Confirm there is sufficient protected local disk space. Use a dedicated local directory with owner-only permissions.

### 4.2 Create database exports

The command structure below follows the official Supabase CLI backup guide. Replace only the environment variable value using the secret-handling procedure approved by the project owner. Do not paste a real connection string into this runbook or a chat.

\`\`\`bash
set -euo pipefail
umask 077

: "\${OLD_DB_URL:?Set OLD_DB_URL securely from the verified source project's Connect panel}"
: "\${BACKUP_DIR:?Set BACKUP_DIR to an approved private local backup directory}"

mkdir -m 700 -p "$BACKUP_DIR"

supabase db dump --db-url "$OLD_DB_URL" -f "$BACKUP_DIR/roles.sql" --role-only
supabase db dump --db-url "$OLD_DB_URL" -f "$BACKUP_DIR/schema.sql"
supabase db dump --db-url "$OLD_DB_URL" -f "$BACKUP_DIR/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"

# Preserve Supabase CLI migration history separately.
supabase db dump --db-url "$OLD_DB_URL" -f "$BACKUP_DIR/history_schema.sql" --schema supabase_migrations
supabase db dump --db-url "$OLD_DB_URL" -f "$BACKUP_DIR/history_data.sql" --use-copy --data-only --schema supabase_migrations

test -s "$BACKUP_DIR/roles.sql"
test -s "$BACKUP_DIR/schema.sql"
test -s "$BACKUP_DIR/data.sql"
test -s "$BACKUP_DIR/history_schema.sql"
test -s "$BACKUP_DIR/history_data.sql"

sha256sum "$BACKUP_DIR"/*.sql > "$BACKUP_DIR/SHA256SUMS"
chmod -R go-rwx "$BACKUP_DIR"
sha256sum --check "$BACKUP_DIR/SHA256SUMS"

unset OLD_DB_URL
\`\`\`

The \`storage.buckets_vectors\` and \`storage.vector_indexes\` exclusions are shown in Supabase's documented data-dump example. Review whether they exist in the current source before executing; do not silently change the command for an unfamiliar schema.

**Coverage warning:** Supabase CLI logical dumps exclude managed \`auth\`, \`storage\`, and extension schemas. The \`history_*\` exports preserve the CLI migration ledger, not Auth users. Review the project's customisations to managed schemas separately. Supabase documents that Auth/Storage custom triggers and policies may need to be recreated from reviewed migrations or a schema diff. Do not assume the generic dump has captured them.

### 4.3 Verify and store the files

The operator must record the following evidence without recording secrets or personal data:

- Source project ref and region, capture timestamp in UTC, CLI version, PostgreSQL client version, and exact commands used.
- Exit code for every dump command; every file exists and has non-zero size.
- SHA-256 manifest generated and verified successfully.
- Archive/dump parsing or SQL inspection completed. Because these are plain SQL files, a checksum alone does not prove they can be restored.
- Private destination path/object version, server-side encryption status, access-control owner, retention/deletion policy, and successful re-download of the stored artifacts.
- A malware/secret scan of scripts and documentation, not a scan that uploads production SQL to a public service.
- \`git status --short\` is clean of backup artifacts and \`git check-ignore -v\` confirms the protected backup paths are ignored.
- The operator confirms that no production dump, generated data file, password, token, connection string, or personal record was committed.

Do not include backup files, hashes that identify individual records, or sensitive metadata in the PR. Keep an evidence record with artifact names, timestamps, checksums and restricted storage references only.

### 4.4 Storage files, Auth, and project configuration

Database backups do **not** include the binary objects stored via Supabase Storage. The existing project inventory identifies the private buckets \`employee-profile-evidence\` and \`training-evidence\`. Back up the actual files from each bucket separately using a supported Supabase Storage CLI workflow or a reviewed S3-compatible client workflow. Preserve object paths, MIME type, cache-control and other required metadata. Verify file counts and checksums in the protected backup destination. Do not enable the S3 protocol or create S3 credentials without approval.

The Supabase CLI logical database dump excludes the managed Auth schema. A full Auth-user restore is not established by the current Free-plan CLI route. Have the project owner confirm a supported, tested Auth recovery method with Supabase. The paid Restore-to-a-new-project feature documents that Auth user data is transferred, but it still requires paid-plan eligibility and source physical backups and does not copy Storage objects/settings or project configuration.

Separately inventory and securely re-provision, as applicable: Edge Functions and their deployment configuration; function secrets; Auth settings and external identity-provider settings; API keys; Realtime configuration/publications; database extensions and settings; network/SSL restrictions; custom domains; and any third-party integrations. Secrets must be reissued or transferred through approved secret-management processes, never copied into the repository or this document.

## 5. Isolated restore drill

**BLOCKED. No restore has been attempted.**

The existing preview branch is not approved as a restore target. Its exposed metadata shows the parent project reference and branch project reference as the same value, it is data-less and non-persistent, and the connector did not return a distinct database host/ref. A healthy preview status does not prove database separation.

### 5.1 Establish a real isolated target

A human project owner must provision or identify a separate, disposable non-production Supabase project, with:

- A unique project reference and database hostname distinct from production.
- Region and Postgres compatibility recorded.
- No production traffic, aliases, Auth callbacks, webhooks, scheduled jobs, external integrations, or irreplaceable data.
- No copied production Storage objects exposed to application users.
- Separate test-only credentials and secrets.
- Explicit confirmation of plan quotas and any costs before creation.

For the existing preview branch, the Supabase CLI exposes a branch-details command:

\`\`\`bash
supabase branches get security-remediation-test --project-ref yabogftzcmqeybjnoazy
\`\`\`

Use it only as a read-only inspection. Treat all connection output as sensitive. Record only whether the returned database reference and host are distinct from production; do not copy credentials into logs or Git. Until a distinct target is confirmed, this branch remains **unverified and prohibited for restore testing**.

Creating a new project, upgrading a plan, or using paid Restore-to-a-new-project is a human approval step. No such action is performed by this runbook.

### 5.2 Restore a logical database backup

Use only after the target has passed the isolation checks above and the project owner has approved the restore. Confirm the target connection string from the target project's own Connect panel; store it securely in \`NEW_DB_URL\`. Never set it to the production source URL.

The following manual logical restore structure is documented by Supabase. Run it from a trusted workstation against the verified isolated target only:

\`\`\`bash
set -euo pipefail

: "\${NEW_DB_URL:?Set NEW_DB_URL from the verified isolated target's Connect panel}"
: "\${BACKUP_DIR:?Set BACKUP_DIR to the verified private backup directory}"

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$BACKUP_DIR/roles.sql" \
  --file "$BACKUP_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$BACKUP_DIR/data.sql" \
  --dbname "$NEW_DB_URL"

# Restore the Supabase CLI migration ledger separately.
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$BACKUP_DIR/history_schema.sql" \
  --file "$BACKUP_DIR/history_data.sql" \
  --dbname "$NEW_DB_URL"

unset NEW_DB_URL
\`\`\`

This is a logical database restore, not a full-project restore. Review the target's default privileges, custom roles, extensions, webhooks, triggers, Auth/Storage schema customisations and encryption requirements before execution. Supabase's restore guide notes that custom roles may need password resets and that managed-schema customisations may need a separate diff/migration process. Stop on any unexpected ownership, privilege, extension, or SQL error. Do not bypass an error by granting broad privileges or disabling security controls.

### 5.3 Post-restore validation checklist

- [ ] Verified that the target project ref and database host are not production.
- [ ] Restore commands exited successfully with \`ON_ERROR_STOP\`; logs contain no credentials or personal data.
- [ ] Schema/table/view inventory matches the expected source inventory.
- [ ] Constraints, foreign keys, unique indexes, non-unique indexes, and extension dependencies are present.
- [ ] RLS enablement, force-RLS state, policy definitions, function ownership/ACLs, SECURITY DEFINER status/search paths, and trigger definitions match the approved snapshot.
- [ ] The \`supabase_migrations\` history matches the backup manifest and the source ledger captured at backup time.
- [ ] Aggregate row counts for approved critical tables match. Do not print user-level rows or identities.
- [ ] Database roles and grants are correct; custom role passwords are rotated/reset securely.
- [ ] Auth user recovery has been separately demonstrated with a designated test account using the approved method. A successful database restore alone does not satisfy this check.
- [ ] Storage buckets/settings have been recreated as required, objects have been copied, and sample files pass checksum and download tests under the intended test roles.
- [ ] Edge Functions, secrets, Auth settings, Realtime, extensions, webhooks, network settings and API integration configuration are reviewed and restored as required.
- [ ] Application smoke tests use test credentials and target URLs only. Verify sign-in, employee access, project workflows, training submissions, evidence upload/download, and offboarding without contacting production users or services.
- [ ] Measured database and application RTO/RPO are recorded, limitations documented, and an operator signs off the drill.

A restore drill is successful only after these checks are evidenced. Merely writing this procedure, taking a dump, or seeing a branch marked healthy is not a successful restore.

## 6. Recovery decision tree

1. **A migration fails before commit:** stop the deployment, capture the exact error and migration identity, determine whether the database transaction rolled back, and inspect the target state read-only. Do not rerun automatically.
2. **A migration partially applied or left ambiguous state:** stop all further schema changes. Compare actual schema and ledger state against the pre-change evidence. Have the database owner select a reviewed forward-fix or isolated restore. Do not mark migrations applied/reverted merely to silence the CLI.
3. **An RLS policy or grant causes access failure:** stop the rollout and identify the exact policy/grant change. Apply only the reviewed reverse migration for that change, or restore the affected database to a verified point under the approved recovery plan. Never make tables public or grant broad access as a quick fix.
4. **A function or trigger is broken:** use the migration-specific rollback only if its preconditions still hold and it has been reviewed. The existing rejected-registration rollback is function-only and is not a database restore. It is not safe to assume it reverses application data changes made after the new RPC was used.
5. **Rows were accidentally changed/deleted:** stop or contain writes through the approved incident procedure, preserve audit evidence, identify the required recovery point, and restore into an isolated project first. If in-place PITR/daily restore is ultimately required, obtain explicit downtime and data-loss approval because the production project becomes unavailable during restore. Reconcile legitimate writes after the selected recovery point before resuming service.
6. **Storage objects were lost or overwritten:** restore the object files from the separate Storage backup and validate object metadata, ownership/path rules, and file checksums. A database backup alone cannot restore file contents.
7. **Auth users or project credentials are affected:** invoke the separately approved Auth/provider recovery and credential-rotation procedure. Do not write directly to managed Auth tables.
8. **The target, backup integrity, or blast radius is uncertain:** stop and escalate to the Supabase project owner and incident lead. Preserve evidence. Do not experiment on production.

## 7. Rollback and escalation

- The existing file \`supabase/rollback/20261028_reapply_rejected_registration.rollback.sql\` reverses the proposed registration RPC/trigger function change only. It does not restore table rows, Auth accounts, Storage objects, or the entire database. Review its preconditions before ever using it.
- For a failed database migration, use the migration-specific rollback only when it is demonstrably safe and reviewed; otherwise use an isolated restore/recovery plan.
- Production restore, PITR enablement, plan changes, creation of billable resources, S3 configuration changes, and any command with a production write path require explicit project-owner approval.
- The operator performing a restore must be authorised for the source and target project. The connected integration did not expose role membership or backup/restore permissions. The owner must verify those roles in the Supabase Dashboard before execution.
- Escalate unclear recovery points, missing Auth/Storage coverage, permission errors, inconsistent migration history, or any risk of overwriting production. Never work around an authorization failure.

## 8. Evidence register and completion criteria

Store evidence in an access-controlled incident/recovery record, not in this repository if it contains production dumps or personal data. Reference only the restricted evidence location from the PR.

Record: finding ID, operator, UTC timestamp, exact source/target refs, plan and backup settings, backup object reference/version, checksums, command names and exit codes, restore-test target, validation results, measured RPO/RTO, approvals, exceptions, and remaining blockers.

Phase 0 is **COMPLETE** only when all of the following are true:

- [ ] Production project identity, plan and effective operator permissions verified.
- [ ] A suitable recoverable backup or restore point exists and its source, timestamp, coverage and retention are verified.
- [ ] Backup integrity is checked and artifacts are securely stored outside the project and repository.
- [ ] Auth user recovery, Storage files/metadata recovery, and project configuration recovery have defined supported methods.
- [ ] An isolated restore target is verified by distinct project ref and host, with data separation and access controls demonstrated.
- [ ] A restore has actually completed in that isolated target and all post-restore checks pass.
- [ ] RPO/RTO are measured or explicitly accepted as service objectives by the owner.
- [ ] The production-change gate is satisfied and the recovery evidence is linked in the record.
- [ ] No unauthorised production changes occurred and all remaining limitations are explicitly accepted.

Until those checks pass, Phase 0 remains **PARTIALLY COMPLETE** and production database changes remain blocked.

## 9. Official references

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI: \`db dump\`](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project)
- [Supabase Storage: Download Objects](https://supabase.com/docs/guides/storage/management/download-objects)
- [Supabase CLI: Preview Branches](https://supabase.com/docs/reference/cli/supabase-branches)
