-- Prevent non-skill claim types from carrying skill IDs into the profile claims table.
ALTER TABLE public.employee_profile_claims
  ADD CONSTRAINT employee_profile_claim_non_skill_has_no_skill_id
  CHECK (claim_type = 'skill' OR skill_id IS NULL);
