import { describe, expect, it } from "vitest";
import { canIssueAccess } from "../../supabase/functions/admin-access-link/permissions";

describe("manual access delivery permissions", () => {
  it("allows only administrators to issue access", () => {
    expect(canIssueAccess(false, false, ["cooperado"], false)).toBe(false);
    expect(canIssueAccess(true, false, ["cooperado"], false)).toBe(true);
  });
  it("requires master permission for privileged accounts", () => {
    expect(canIssueAccess(true, false, ["admin"], false)).toBe(false);
    expect(canIssueAccess(true, false, ["moderador"], false)).toBe(false);
    expect(canIssueAccess(true, true, ["admin"], false)).toBe(true);
  });
  it("does not generate a recovery link for the caller's own account", () => {
    expect(canIssueAccess(true, true, ["admin"], true)).toBe(false);
  });
});