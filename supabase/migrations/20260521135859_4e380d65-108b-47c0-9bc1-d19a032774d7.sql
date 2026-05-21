ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS course_started_at_snapshot timestamptz,
  ADD COLUMN IF NOT EXISTS enrollment_number_snapshot text,
  ADD COLUMN IF NOT EXISTS cooperativa_snapshot text;