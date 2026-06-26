INSERT INTO public.app_settings (key, value)
VALUES ('cooperado_auto_approve', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;