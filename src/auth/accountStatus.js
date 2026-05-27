/** Account states that revoke portal access (403). JWT + Neon row presence is otherwise enough. */
const BLOCKED_ACCOUNT_STATUSES = new Set(["suspended", "blocked"]);

/**
 * @param {unknown} status Users.status from Neon
 */
export function isBlockedAccountStatus(status) {
  if (typeof status !== "string" || status.length === 0) {
    return false;
  }
  return BLOCKED_ACCOUNT_STATUSES.has(status.trim().toLowerCase());
}
