
CREATE TABLE public.certificate_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates" ON public.certificate_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone authenticated can view active templates" ON public.certificate_templates
  FOR SELECT TO authenticated
  USING (active = true);
