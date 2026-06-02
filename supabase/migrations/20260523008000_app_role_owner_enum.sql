-- Ensure production enum supports separate kindergarten owner users.

alter type public.app_role add value if not exists 'owner';

notify pgrst, 'reload schema';
