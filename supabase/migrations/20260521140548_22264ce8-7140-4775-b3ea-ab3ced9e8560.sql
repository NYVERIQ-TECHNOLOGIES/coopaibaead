INSERT INTO storage.buckets (id, name, public) VALUES ('branding','branding',true) ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read branding') THEN
    CREATE POLICY "Public read branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins manage branding') THEN
    CREATE POLICY "Admins manage branding" ON storage.objects FOR ALL USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;