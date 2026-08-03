ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS use_location boolean NOT NULL DEFAULT true;
ALTER TABLE public.vote_photos ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.vote_photos ADD COLUMN IF NOT EXISTS lng double precision;