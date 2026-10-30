# Togetherly V1 Security Control Matrix

This matrix separates observations from verified controls. `Not tested` does not mean secure or insecure.

| Area | Current evidence | V1 work required | Verification needed | Status |
|---|---|---|---|---|
| Registration reapplication | RPC absent from production; migration and synthetic PostgreSQL tests exist in PR #25 | Run migration twice against isolated Supabase branch; exercise actual application flow; review grants and rollback | Staging migration ledger, RPC behavior, applicant flow, direct-write denial, new registration and reapply cases | Prepared; staging outcome unverified |
| GitHub protection | `main` protected; required validate and DB regression checks, one approval and conversation rules | Keep protection; require lockfile-based install; retain least workflow permissions | CI on latest PR head; deliberate failing job blocks merge | Live protection verified |
| Dependency reproducibility | PR head has no `package-lock.json`; current CI uses `npm install` | Add npm lockfile and switch CI to `npm ci` | Clean CI install, lint, audit, typecheck and build on exact commit | Candidate lockfile awaits CI |
| Employee directory | RLS permits broad active directory read for authenticated users | Decide employee-visible field set; prefer a scoped view or column-level approach where required | Separate employee, manager, HR and admin Supabase sessions; confirm only intended fields/rows | Not multi-account tested |
| `employee_skills` | PR policy limits to active directory, own history, reviewer/admin; synthetic PostgreSQL test passes | Validate with real Supabase JWTs against preview database | Active employee, offboarded employee, reviewer and unrelated employee queries | Code + synthetic tests; live role test pending |
| `activities` | Authenticated SELECT uses `USING (true)`; rows include message, timestamp and type | Decide whether this is a shared feed, personal activity, or audit log; scope by intended model | Cross-user select tests and checks for PII in messages | Design decision pending |
| `app_settings` | Authenticated SELECT uses `USING (true)`; one workspace configuration row observed | Confirm organization-wide read intent; validate that settings do not contain secrets | Employee/reviewer/admin read and write tests | Shared configuration likely; confirm |
| `skills` | Authenticated SELECT uses `USING (true)`; 98 catalog rows observed | Confirm catalog is intentionally shared; restrict mutations to admin as already defined | Employee/reviewer/admin read and mutation tests | Shared catalog likely; confirm |
| `project_requirements` | Authenticated SELECT uses `USING (true)`; zero rows observed | Decide whether all employees may see project skill requirements | Cross-role row visibility tests when data exists | Design decision pending |
| `SECURITY DEFINER` functions | 36 public functions; empty `search_path`; advisor warns about authenticated execute on many | Inventory intended callers; remove only unnecessary execute grants; verify internal authorization checks | Per-function role matrix and negative tests | Review pending |
| TinyFish URL safety | String/IP checks block common local/private literals but do not resolve DNS or govern provider redirects/resolution | Use provider-supported URL/network restrictions or controlled egress proxy; handle DNS rebinding/redirects at actual fetch boundary | Test alternate IPv4/IPv6 forms, DNS to private IP, redirect to metadata/private network, provider behavior | Not proven; hardening pending |
| TinyFish run ownership | Polling checks `run_id` plus `owner_auth_user_id`; run start is sent before ownership row is inserted | Make run registration resilient and recoverable; add quotas, concurrency and usage caps | Cross-user IDs, insert failure after provider acceptance, duplicate retry and limits | Ownership check present; hardening pending |
| Storage | Both buckets private; seven owner/reviewer/admin scoped policies inspected | Validate path ownership and helper behavior for every operation | Real cross-account list/download/upload/overwrite/delete using two employee identities | Policy review only |
| Offboarding | Existing lifecycle code clears Auth link for offboarded records; full session lifecycle not tested | Verify session invalidation, retry/idempotency, API denial, storage and historical audit access | Staged offboarding/re-auth/session/API/storage tests | Partial; end-to-end pending |
| Browser cache isolation | Demo employees filtered from DB-linked records; projects/settings/activities/training submissions persist in shared localStorage | Confirm which items are demo-only; scope demo data by account/session or migrate authoritative shared data to DB | Two-account same-browser test, logout/login, account-switch and demo-mode tests | Not tested |
| Production recovery | Zero backup records listed; PITR disabled; no restore drill | Enable suitable backup/PITR and prove restore, or create durable isolated staging | Restore drill, migration forward/rollback, recovery evidence | Hard blocker |
| Deployment | PR preview READY on recorded head; production remains on `main` | Run authenticated smoke tests on preview and explicit database compatibility test | Login, registration, directory, profile, training, evidence, logout and TinyFish workflows | Preview built; E2E pending |

## Required order to close V1

1. Complete CI clean-install validation for the lockfile candidate; only then retain `npm ci`.
2. Obtain the actual Supabase preview branch project ref/connection details through the supported dashboard or API, then replay and roll back migrations in that no-data preview.
3. Run real JWT-based employee/reviewer/admin tests against preview; add Storage cross-account tests.
4. Add TinyFish provider-boundary restrictions and tests; do not rely on URL string parsing alone.
5. Decide intended sharing for employees, activity feed, app settings, skills catalog, and project requirements; implement policy changes only after that matrix is signed off.
6. Enable and verify production backup/PITR and perform a restore drill.
7. Run authenticated end-to-end regression tests on preview, review the resulting diff, then merge via protected `main`.
8. Apply production migrations only in a separate approved deployment window after restore capability and rollback have been demonstrated.
