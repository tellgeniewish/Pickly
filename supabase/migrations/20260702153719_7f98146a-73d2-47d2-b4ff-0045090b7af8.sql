
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by anyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- votes
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location_name TEXT,
  deadline_hours INT NOT NULL DEFAULT 72,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '72 hours')
);
GRANT SELECT ON public.votes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.votes TO authenticated;
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes readable by anyone with link" ON public.votes FOR SELECT USING (true);
CREATE POLICY "authenticated users create votes" ON public.votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update votes" ON public.votes FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners delete votes" ON public.votes FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX votes_owner_idx ON public.votes(owner_id, created_at DESC);

-- vote_photos
CREATE TABLE public.vote_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL REFERENCES public.votes(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vote_photos TO anon;
GRANT SELECT, INSERT, DELETE ON public.vote_photos TO authenticated;
GRANT ALL ON public.vote_photos TO service_role;
ALTER TABLE public.vote_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vote photos readable by anyone" ON public.vote_photos FOR SELECT USING (true);
CREATE POLICY "owners insert photos" ON public.vote_photos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.votes v WHERE v.id = vote_id AND v.owner_id = auth.uid()));
CREATE POLICY "owners delete photos" ON public.vote_photos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.votes v WHERE v.id = vote_id AND v.owner_id = auth.uid()));
CREATE INDEX vote_photos_vote_idx ON public.vote_photos(vote_id, order_index);

-- vote_sessions (one per voter — auth user or anon)
CREATE TABLE public.vote_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL REFERENCES public.votes(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_key TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.vote_sessions TO anon;
GRANT SELECT, INSERT ON public.vote_sessions TO authenticated;
GRANT ALL ON public.vote_sessions TO service_role;
ALTER TABLE public.vote_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions readable" ON public.vote_sessions FOR SELECT USING (true);
CREATE POLICY "anyone can create session" ON public.vote_sessions FOR INSERT WITH CHECK (true);
CREATE UNIQUE INDEX vote_sessions_auth_uniq ON public.vote_sessions(vote_id, voter_id) WHERE voter_id IS NOT NULL;
CREATE UNIQUE INDEX vote_sessions_anon_uniq ON public.vote_sessions(vote_id, anon_key) WHERE anon_key IS NOT NULL;

-- vote_choices
CREATE TABLE public.vote_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.vote_sessions(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES public.vote_photos(id) ON DELETE CASCADE,
  liked BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, photo_id)
);
GRANT SELECT, INSERT ON public.vote_choices TO anon;
GRANT SELECT, INSERT ON public.vote_choices TO authenticated;
GRANT ALL ON public.vote_choices TO service_role;
ALTER TABLE public.vote_choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "choices readable" ON public.vote_choices FOR SELECT USING (true);
CREATE POLICY "anyone can create choices" ON public.vote_choices FOR INSERT WITH CHECK (true);
CREATE INDEX vote_choices_photo_idx ON public.vote_choices(photo_id, liked);

-- ai_analyses (cached per vote)
CREATE TABLE public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL UNIQUE REFERENCES public.votes(id) ON DELETE CASCADE,
  summary TEXT,
  space_keywords JSONB DEFAULT '[]'::jsonb,
  top_analysis JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_analyses TO anon;
GRANT SELECT ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analyses readable" ON public.ai_analyses FOR SELECT USING (true);

-- Storage policies for vote-photos bucket (public bucket, owners write)
CREATE POLICY "vote-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vote-photos');
CREATE POLICY "authenticated users upload own vote-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vote-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "authenticated users delete own vote-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vote-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
