ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS eventual boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_courses_eventual ON public.courses(eventual);