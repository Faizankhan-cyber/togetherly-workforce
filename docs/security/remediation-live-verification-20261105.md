# Togetherly security remediation update

**Captured:** 5 November 2026 (UTC)  
**Repository baseline:** `main` at `c815e409196c68e89c35a123aa946a7ab0b6db6c`  
**Production project:** Supabase `yabogftzcmqeybjnoazy`  
**Production app:** https://togetherly-tinyfish.vercel.app/

This update records the latest read-only audit and the production changes applied on 5 November 2026. It supersedes older statements only where it explicitly says so. Historical baseline documents are retained as historical records.

## Changes applied and verified

### 1. Employee skills visibility

Applied migration `20261030100000_employee_skills_visibility`.

Live migration ledger version: `20261105135642`.

- Removed the broad policy `Anyone authenticated can view employee skills`.
- Added `Active directory or own employee skills visible`.
- Reads are limited to the active directory, the signed-in employee's own skills, and authorized reviewers/admins.
- Verified the old policy is absent and the narrower policy is present.
- Existing manager/admin management policy remains in place.

### 2. Profile avatar storage

Applied migration `20261031120000_profile_avatars`.

Live migration ledger version: `20261105135710`.

- Confirmed `employees.avatar_url` exists; the migration uses `ADD COLUMN IF NOT EXISTS`, so it safely reconciles the earlier manual column addition.
- Created the `profile-avatars` bucket.
- Bucket is public for profile image delivery, with a 5 MiB limit and PNG/JPEG/WebP/GIF allowlist.
- Upload and update policies restrict writes to the authenticated user's own top-level folder.
- Read policy is available to authenticated users. Because the bucket is public, anyone with an image URL can view an avatar. Do not store sensitive evidence in this bucket.
- Verified the bucket metadata and all three policies exist.

### 3. Supabase Auth hardening

Applied and read back the following settings:

- Minimum password length: 12 characters.
- Require reauthentication before password changes: enabled.
- Secure email-change confirmation: enabled.
- Email confirmation remains required; automatic email confirmation remains disabled.
- TOTP MFA enrollment and verification remain enabled.

The following controls remain outstanding:

- HaveIBeenPwned leaked-password checks are plan-gated on the current Supabase plan (the API returned HTTP 402 stating Pro or higher is required).
- CAPTCHA is not enabled because no CAPTCHA secret is configured. Do not enable it until a provider account and secret are supplied.
- TOTP support is enabled, but an enforced MFA requirement for privileged roles has not been implemented or verified. Do not describe this as mandatory MFA.

## Findings still open

### Training workflow persistence — high functional priority

The live tables `training_assignments`, `training_submissions`, and `verification_audit_logs` currently contain zero rows.

The current UI handlers in `src/context/DataContext.tsx` update React state only for progress, submission, resubmission, and review operations. They do not write the corresponding records to Supabase. The submission and review UI also contains demo identity assumptions (including a fixed employee selection and reviewer ID).

The database already has RLS policies and integrity triggers for these tables. The repair must use the authenticated employee identity, preserve the existing trigger checks, persist audit entries, load submissions from the database, and store evidence using the private `training-evidence` bucket. This work is not marked complete in this update.

### GitHub repository security settings

Current `main` protection remains enabled with one required approval, stale-review dismissal, latest-push approval, required CI checks, conversation resolution, linear history, and force-push/deletion restrictions.

- Secret scanning is enabled and push protection is enabled.
- No open secret-scanning alerts were returned during this audit.
- Dependabot security updates are currently disabled.
- Enabling repository-level Dependabot settings was not completed through the available connected GitHub actions. This remains an owner-side setting to enable and verify.
- Required-signature enforcement and non-provider secret patterns are not enabled.

### Authentication and role testing

- No dedicated role-by-role live API test has been completed for Admin, Manager, HR, and Employee accounts.
- Do not use a single production account to infer the permissions of every role.
- CAPTCHA and privileged-role MFA enforcement remain open as noted above.

### Migration history reconciliation

- The two previously missing migrations are now tracked in the live migration ledger.
- The older initial schema file `20261016_initial_schema.sql` is still not represented as a normal live migration entry. The database was provisioned before the current migration history was fully established.
- Do not replay the initial schema migration against production. Reconcile the baseline separately using a schema diff and a proper backup/restore plan.
- The manual `avatar_url` addition is now safely covered by the idempotent avatar migration.

### Backup and restore readiness

A verified restorable production backup/PITR restore point has not been established by this run. Do not make broad destructive schema or data changes until a backup and restore path are verified.

## Verification snapshot

| Area | Result |
|---|---|
| Supabase services | Healthy at audit time |
| Public table RLS | Enabled on all 18 inspected public tables |
| Employee skills read policy | Narrowed and verified |
| Avatar bucket and policies | Created and verified |
| Applied migration ledger | 22 entries after these two changes |
| Auth password minimum | 12 |
| Password reauthentication | Enabled |
| Secure email change | Enabled |
| TOTP capability | Enabled, enforcement not verified |
| Open secret-scanning alerts | None returned |
| Dependabot security updates | Disabled |
| Training workflow persistence | Not fixed |
| Role-by-role access tests | Pending |
| Restorable production backup | Not verified |

## Operational notes

- No employee records were modified.
- No secrets or secret values were read or written by this audit.
- No Vercel environment variables were changed.
- Production `main` was not modified directly.
- The changes in this update are limited to the two reviewed Supabase migrations and Auth settings described above.
- The initial schema was not re-run.
