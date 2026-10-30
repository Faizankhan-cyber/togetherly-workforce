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
