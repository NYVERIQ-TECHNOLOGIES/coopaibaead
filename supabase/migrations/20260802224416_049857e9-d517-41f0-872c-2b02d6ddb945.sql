GRANT SELECT ON public.cooperativas TO anon;
CREATE POLICY "Anyone can view active cooperativas"
ON public.cooperativas FOR SELECT TO anon
USING (active = true);