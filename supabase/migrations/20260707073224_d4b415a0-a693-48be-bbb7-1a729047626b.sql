
-- ai_analyses: vote owners can read
CREATE POLICY "vote owners read ai analyses" ON public.ai_analyses
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.votes v WHERE v.id = ai_analyses.vote_id AND v.owner_id = auth.uid()));

-- vote_sessions: vote owners read all sessions for their vote; voters read own
CREATE POLICY "vote owners read sessions" ON public.vote_sessions
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.votes v WHERE v.id = vote_sessions.vote_id AND v.owner_id = auth.uid()));

CREATE POLICY "voters read own sessions" ON public.vote_sessions
FOR SELECT TO authenticated
USING (voter_id IS NOT NULL AND voter_id = auth.uid());

-- vote_choices: vote owners read choices in their votes; voters read their own
CREATE POLICY "vote owners read choices" ON public.vote_choices
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.vote_sessions s
  JOIN public.votes v ON v.id = s.vote_id
  WHERE s.id = vote_choices.session_id AND v.owner_id = auth.uid()
));

CREATE POLICY "voters read own choices" ON public.vote_choices
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.vote_sessions s
  WHERE s.id = vote_choices.session_id AND s.voter_id = auth.uid()
));

-- storage.objects: vote-photos bucket - owner-scoped SELECT and UPDATE by folder prefix
CREATE POLICY "owners read own vote photo files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'vote-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "owners update own vote photo files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'vote-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'vote-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
