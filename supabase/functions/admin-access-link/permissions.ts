export function canIssueAccess(callerIsAdmin: boolean, callerIsMaster: boolean, targetRoles: string[], isSelf: boolean): boolean {
  if (!callerIsAdmin || isSelf) return false;
  return callerIsMaster || !targetRoles.some(role => role === "admin" || role === "moderador");
}