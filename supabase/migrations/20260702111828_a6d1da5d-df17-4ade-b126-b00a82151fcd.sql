DELETE FROM public.user_roles WHERE user_id='63e70b65-02bd-40da-9000-0128906e95c5';
INSERT INTO public.user_roles(user_id, role) VALUES ('63e70b65-02bd-40da-9000-0128906e95c5', 'cooperado') ON CONFLICT DO NOTHING;
UPDATE public.profiles SET full_name='Victor Farias dos Santos', cpf='12916112405' WHERE user_id='63e70b65-02bd-40da-9000-0128906e95c5';
UPDATE public.cooperado_pending_registrations SET status='approved', reviewed_at=now() WHERE id='1bdb22e3-1e93-47f3-ae34-75418fa1122f';