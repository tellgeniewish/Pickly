
-- Remove public/authenticated SELECT policies; server functions use service_role
DROP POLICY IF EXISTS "sessions readable" ON public.vote_sessions;
DROP POLICY IF EXISTS "choices readable" ON public.vote_choices;
DROP POLICY IF EXISTS "votes readable by anyone with link" ON public.votes;
DROP POLICY IF EXISTS "vote photos readable by anyone" ON public.vote_photos;
DROP POLICY IF EXISTS "analyses readable" ON public.ai_analyses;

-- Revoke direct SELECT grants so RLS/policies don't need to allow it either
REVOKE SELECT ON public.vote_sessions FROM anon, authenticated;
REVOKE SELECT ON public.vote_choices FROM anon, authenticated;
REVOKE SELECT ON public.votes FROM anon;
REVOKE SELECT ON public.vote_photos FROM anon;
REVOKE SELECT ON public.ai_analyses FROM anon, authenticated;

-- Keep authenticated SELECT on votes/vote_photos only for the owner via new policies
CREATE POLICY "owners read votes" ON public.votes FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owners read own vote photos" ON public.vote_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.votes v WHERE v.id = vote_id AND v.owner_id = auth.uid()));
