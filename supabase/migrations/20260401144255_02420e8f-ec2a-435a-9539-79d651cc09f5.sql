
-- Modules table
CREATE TABLE public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  locked boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view modules" ON public.course_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert modules" ON public.course_modules FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update modules" ON public.course_modules FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete modules" ON public.course_modules FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Lessons table
CREATE TABLE public.course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'video',
  duration text,
  completed boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view lessons" ON public.course_lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert lessons" ON public.course_lessons FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update lessons" ON public.course_lessons FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete lessons" ON public.course_lessons FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Evaluations table
CREATE TABLE public.course_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'prova',
  duration int NOT NULL DEFAULT 60,
  questions int NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.course_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view evaluations" ON public.course_evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert evaluations" ON public.course_evaluations FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update evaluations" ON public.course_evaluations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete evaluations" ON public.course_evaluations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Books / supplementary materials per course
CREATE TABLE public.course_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'pdf',
  size text,
  cooperado_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.course_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view books" ON public.course_books FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert books" ON public.course_books FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update books" ON public.course_books FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete books" ON public.course_books FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
