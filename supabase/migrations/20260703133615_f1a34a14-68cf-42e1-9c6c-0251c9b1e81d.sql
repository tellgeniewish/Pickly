
DROP POLICY IF EXISTS "vote-photos public read" ON storage.objects;
-- Restrict profiles read to authenticated users
DROP POLICY IF EXISTS "profiles readable by anyone" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
