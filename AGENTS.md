# Architecture decisions
- Keep meetings in separate public tables from live classes because meetings have independent invitations and access rules.
- Use database-validated RPCs for meeting lifecycle, admission and attendance because UI-only authorization is unsafe.
- Use RLS-protected meeting_signals postgres changes for WebRTC negotiation instead of unrestricted realtime broadcast because private meeting links must not leak media signaling.
- Record meeting media locally through MediaRecorder; browser downloads remain available without a storage provider and no recording bytes enter database rows.
- Authorize media downloads through exact references to RLS-visible content and caller-specific course/cooperative permissions; keep catalog covers and introductions shared, but templates and unreferenced objects admin-only to prevent storage access bypasses.
