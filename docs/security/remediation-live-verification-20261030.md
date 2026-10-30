# Togetherly Remediation: Phase 0 Baseline

**Captured:** 30 October 2026 (UTC)  
**Scope:** read-only production inspection plus creation of the isolated Git remediation branch. No production migration, policy, account, or data changes were made.

## Baseline identity and deployment

- Repository: `Faizankhan-cyber/togetherly-workforce`
- `main` HEAD: `50160172f69c822f1947ee57c6f198d3df046cd2`
- Vercel production deployment: `dpl_6L2gv5iweituD61uqXHJ8XK8B3eX`
- Vercel state: `READY / `PROMOTED`; production alias is assigned.
- Deployed commit equals the `main` HEAD recorded above.
- Public domain: `https://togetherly-tinyfish.vercel.app`
- **Runtime smoke-test limit:** Vercel metadata confirms a ready/promoted deployment. A direct HTTP GET from this execution environment failed at DNS resolution, so the application route response was not independently exercised.

## GitHub and CI/CD baseline

- A dedicated branch, `security/remediation-v1`, was created from the exact `main` SHA above.
- `main` currently has no branch protection/ruleset. The branch inventory returned 26 branches, with 0 protected.
- The repository has 6 collaborators; 1 has admin permission and 6 have push permission. Individual identities are intentionally omitted from this audit note.
- `.github/workflows/validate.yml` currently installs dependencies with `npm install --no-audit --no-fund`, then runs TypeScript type-check and a production build. It does not run lint, unit tests, authorization tests, policy tests, or dependency vulnerability checks.
- `package.json` defines a lint script but no test script. No test directory or test-runner config exists on `main`.
- No root package lockfile is present. The workflow uses `npm install`, not lockfile-based `npm ci`, so dependency resolution is not fully reproducible.

## Supabase baseline

- Connected project: `togetherly` (`yabogftzcmqeybjnoazy`), region `ap-southeast-1`.
- All eight reported Supabase services are `ACTIVE_HEALTHY`.
- No second Supabase project is visible to the connected account, and `SUPABASE_LIST_DATABASE_BRANCHES` returned no branches. There is no isolated staging database currently available.
- `SUPABASE_LIST_BACKUPS` returned zero backup records; PITR is disabled. The Postgres configuration export returned no fields. Therefore **a restorable backup has not been verified**.
- The accompanying JSON is a schema/security metadata snapshot (columns, relationships, RLS metadata, policies, triggers, function ACL metadata, indexes and migration history). It contains no row samples, employee identifiers, email addresses, auth identifiers, or secrets. It is **not** a full `pg_dump` and cannot restore production data.
- The database inventory reports 18 public tables and 8 storage tables. RLS is enabled on all listed tables; RLS is not forced on them.
- Two storage buckets exist: `employee-profile-evidence` and `training-evidence`. Both are private. Their upload rules accept PDF/PNG/JPEG/WebP with respective 10 MiB and 5 MiB limits.
- The catalog snapshot records 52 RLS policies, 16 non-internal triggers, 84 indexes and 36 public functions marked `SECURITY DEFINER`. All 36 have `search_path` set to empty; execute grants and exact policy expressions are included in the JSON snapshot for later review.
- Broad authenticated read policies were confirmed for `activities`, `app_settings`, `employee_skills`, `project_requirements`, and `skills` (the policies use `USING (true)`). These are review findings, not changes made in Phase 0.

## Migration history and rejected-registration issue

- The live migration ledger contains 20 applied versions. The applied list is recorded in the JSON snapshot.
- `supabase/migrations/20261028_reapply_rejected_registration.sql` exists on `main` but its migration version is **not** in the live migration history.
- The live database contains `public.employee_registration_requests`; it has a unique constraint on `auth_user_id`, a status check for pending/approved/rejected, and a `BEFORE INSERT OR DELETE OR UPDATE` security trigger.
- The live `public.reapply_my_registration_request(text,text,text)` RPC is absent.
- The live `public.enforce_registration_request_security_guard()` function does not contain the `v_is_self_reapply` branch present in the repository migration. Its exact pre-migration definition is preserved in `supabase/rollback/20261028_reapply_rejected_registration.rollback.sql`.
- `IdentityPendingPage.tsx` calls `reapplyMyRegistrationRequest`; `AuthContext.tsx` invokes `supabase.rpc('reapply_my_registration_request', ...)` and refreshes the session after success.
- Current aggregate data counts: 6 confirmed Auth users; 6 registration requests (all approved; none pending or rejected); 15 employee records (6 active and 9 offboarded). Active records by role: 3 admins, 2 HR, 1 manager, 0 employees. Offboarded records by role: 2 admins, 1 HR, 1 manager, 5 employees. No personal data is included.

## Browser storage inventory

`DataContext.tsx` reads/writes the following browser `localStorage` keys:

| Key | Current classification |
|---|---|
| `togetherly_role` | Demo/preview role preference; authenticated role is derived from the linked employee record. |
| `togetherly_employees` | Local/demo employee records only; database-linked employees are filtered out before persistence. |
| `togetherly_projects` | Project state, still persisted in browser storage. |
| `togetherly_settings` | Workspace settings, still persisted in browser storage. |
| `togetherly_activities` | Activity feed, still persisted in browser storage. |
| `togetherly_training_submissions` | Training submission state, still persisted in browser storage. |

`AuthContext.tsx` uses `sessionStorage` for the explicit `togetherly_demo_mode` flag. The above project/settings/activity/training data needs classification and migration planning in Phase 7; no data was moved or cleared.

## Recovery and rollback decision

1. The repository branch and schema/security metadata snapshot preserve the exact code baseline and structural observations.
2. A targeted reverse SQL file is included for the rejected-registration migration: drop the new RPC and restore the live pre-migration trigger function. This is sufficient only for reverting the function-only migration **before the new RPC is used**.
3. There is no verified full-database restore point. The metadata snapshot is not a substitute for a data backup.
4. **Stop condition:** do not apply the rejected-registration migration or any RLS/production account changes until either (a) a database backup/PITR restore point is available and tested or (b) an isolated staging database has been provisioned and migration/rollback tested there.

## Phase 0 checklist status

| Item | Status | Evidence / limit |
|---|---|---|
| 0.1 Production deployment | Partial | Vercel READY/PROMOTED; direct HTTP smoke test blocked by DNS from this environment. |
| 0.2 Production commit matches GitHub | Complete | Vercel deployment SHA equals `main` HEAD. |
| 0.3 Dedicated remediation branch | Complete | `security/remediation-v1` points to baseline `main` SHA. |
| 0.4 Migration history | Complete | 20 applied versions recorded; rejected-registration migration absent. |
| 0.5 Schema/migration snapshot | Partial | Structured metadata snapshot captured; no restorable `pg_dump`/backup exposed. |
| 0.6 Rollback procedure | Partial | Function-only reverse SQL preserved; no database-wide restore point. |
| 0.7 Role/account inventory | Complete | Aggregate-only counts recorded; no identities exposed. |
| 0.8 localStorage inventory | Complete | Six keys classified from `DataContext.tsx`; demo flag from `AuthContext.tsx`. |

**Phase 0 is not fully complete because backup/restore capability and a staging database are unverified.** Phase 1 can be prepared on this branch and tested in an ephemeral development PostgreSQL environment, but production application is blocked by the stop condition above.

## Live verification addendum (30 October 2026, 14:35 IST)

This addendum records a later read-only verification. It does not rewrite the original capture above; the original branch-protection and staging observations remain historical snapshots taken at the time of the initial baseline.

### GitHub / PR #25

- `main` is currently protected. Live branch settings require the `validate` and `Database security regression tests` checks, one approving pull-request review, stale-review dismissal, approval of the latest push, conversation resolution, and linear history. Force-push and branch deletion are disabled.
- The feature branch `security/remediation-v1` is not protected; this is separate from protection of `main`.
- PR #25 remains open and unmerged. Its head at verification was `2685889833709a3822658ba6ff7d1daf41548112`, 7 commits ahead of `main` and 0 behind. The two required CI checks and Vercel preview-comment check passed on that exact commit. An approving review is recorded on that commit.
- No inline review comments were returned. The PR description's earlier statement that `main` has no branch protection is stale; the live settings above supersede it for current decisions.

### Vercel

- A preview deployment for PR #25 was `READY` with its preview alias assigned. It was built from `security/remediation-v1` commit `2685889833709a3822658ba6ff7d1daf41548112`. This is preview evidence, not a production deployment.
- The production deployment remains on `main`; no production promotion or deployment was initiated by this verification.
- The preview deployment events endpoint returned 404 when called with the preview alias. A successful deployment status is therefore confirmed, but a detailed event-log review and independent end-to-end browser smoke test are not claimed.

### Supabase

- The connected account currently exposes one no-data database branch named `security-remediation-test`, linked to `security/remediation-v1`, status `FUNCTIONS_DEPLOYED`, preview service status `ACTIVE_HEALTHY`, and `persistent=false`.
- This is an isolated, ephemeral preview database branch, not a durable staging environment. The branch status is not `MIGRATIONS_PASSED`; no successful application of the PR migration to this branch is claimed.
- The branch-list API returns a UUID branch record ID, while the connector's branch-configuration action requires a 20-character project ref. The connector did not expose that ref in the branch response. No database credentials were guessed and no migrations were sent to the production project.
- The production project still lists zero backups and has PITR disabled. No verified production restore point or restore drill is available.
- Current catalog inventory reports 18 public tables, 45 public RLS policies and 7 storage-object policies. The earlier metadata snapshot recorded 52 public RLS policies; this count difference requires reconciliation of snapshot scope/time before treating either total as a canonical invariant.
- The seven live storage policies restrict reads/writes/deletes by employee path ownership or reviewer/admin role. Policy definitions were inspected read-only; real cross-account Storage API tests remain outstanding.
- The security advisor currently reports 35 warnings for authenticated execution of `SECURITY DEFINER` functions and one leaked-password-protection warning. These are advisor findings, not 36 confirmed vulnerabilities. The 36 reviewed functions use an empty `search_path`; execute grants and intended callers still need function-by-function review.

### Current merge / deployment gate

- The no-data preview branch is useful for an isolated migration test only after its database connection details and migration outcome can be independently verified.
- Do not apply migrations or RLS/authorization changes to production while there is no verified restorable backup/PITR point.
- A successful GitHub check or Vercel preview build does not prove production database migration safety, cross-user access isolation, or TinyFish provider-side SSRF protections.
