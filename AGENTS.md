# Architecture decisions
- Store institutional CNPJ/NIRE separately from CPF, with admin/service-only identity changes; login maps CNPJ to a synthetic account email, and institutional profiles never require birthdate, preserving individual validation.
- Keep meetings in separate public tables from live classes because meetings have independent invitations and access rules.
- Use database-validated RPCs for meeting lifecycle, admission and attendance because UI-only authorization is unsafe.
- Use RLS-protected meeting_signals postgres changes for WebRTC negotiation instead of unrestricted realtime broadcast because private meeting links must not leak media signaling.
- Record meetings locally by capturing the meeting tab (getDisplayMedia with tab audio, mixed with the mic) into MediaRecorder, for both native and Google Meet rooms; Meet cannot be embedded or recorded via API without Workspace, and no recording bytes enter database rows.
- Authorize media downloads through exact references to RLS-visible content and caller-specific course/cooperative permissions; keep catalog covers and introductions shared, but templates and unreferenced objects admin-only to prevent storage access bypasses.
- Log every lesson-video play start to public.video_play_events (user, lesson, course, timestamp) via a fire-and-forget insert on the player's onPlay; it must never change player behavior or block playback, and reads are limited to the owner plus admin/moderador.

- Meeting agenda/description AI generation goes through the meeting-agenda-ai edge function (Lovable AI Gateway, LOVABLE_API_KEY server-side, restricted to admin/moderador/professor); never call the gateway from the browser.
