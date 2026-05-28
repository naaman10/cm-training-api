/**
 * Parse Neon/API `role` string into Auth0 role names (comma-separated in DB).
 * @param {unknown} role
 * @returns {string[]}
 */
export function parseRoleNamesFromDbRole(role) {
  if (typeof role !== "string" || !role.trim()) {
    return [];
  }
  return role
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
