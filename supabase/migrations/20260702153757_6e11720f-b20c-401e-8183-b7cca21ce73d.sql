
-- Remove permissive anon INSERT policies; server functions with service_role handle voting writes
DROP POLICY IF EXISTS "anyone can create session" ON public.vote_sessions;
DROP POLICY IF EXISTS "anyone can create choices" ON public.vote_choices;

-- Revoke direct client INSERT grants; only service_role writes
REVOKE INSERT ON public.vote_sessions FROM anon, authenticated;
REVOKE INSERT ON public.vote_choices FROM anon, authenticated;

-- Restrict trigger function execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
