-- UX-08: let a Garden manager review the professional profile attached to an
-- application for a Garden they manage. Candidate profiles remain private to
-- the candidate, admins, and managers with an actual canonical application.

drop policy if exists "staff candidate manager recruitment read" on public.staff_candidate_profiles;
create policy "staff candidate manager recruitment read"
  on public.staff_candidate_profiles
  for select
  using (
    public.is_admin()
    or profile_id = auth.uid()
    or exists (
      select 1
      from public.staff_job_applications application
      where application.staff_candidate_id = staff_candidate_profiles.profile_id
        and public.can_manage_garden(application.garden_id)
    )
  );

comment on policy "staff candidate manager recruitment read" on public.staff_candidate_profiles is
  'Candidate professional data is visible only to the candidate, admins, or a manager reviewing that candidate through an application to their managed Garden.';
