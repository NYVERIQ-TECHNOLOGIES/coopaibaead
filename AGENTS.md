# Architecture decisions
- Keep meetings in separate public tables from live classes because meetings have independent invitations and access rules.
- Use database-validated RPCs for meeting lifecycle, admission and attendance because UI-only authorization is unsafe.
- Use RLS-protected meeting_signals postgres changes for WebRTC negotiation instead of unrestricted realtime broadcast because private meeting links must not leak media signaling.
- Record meeting media locally through MediaRecorder; browser downloads remain available without a storage provider and no recording bytes enter database rows.
- Authorize media downloads through exact references to RLS-visible content and caller-specific course/cooperative permissions; keep catalog covers and introductions shared, but templates and unreferenced objects admin-only to prevent storage access bypasses.
- Enforce initial-password rotation using service-only password digests, restrictive RLS, a Data API pre-request guard and authenticated function guards; user-editable flags cannot unlock accounts.
- Keep cooperative registration approvals manual and issue individual temporary passwords because shared credentials plus CPF identification allow impersonation.
- Export spreadsheets through the shared write-excel-file helper because the retired spreadsheet packages have unpatched security advisories.
- Preserve the auth context identity through Vite hot updates so mounted providers and refreshed consumers cannot diverge.
