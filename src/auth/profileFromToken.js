/**
 * Pull profile fields from Auth0 access token claims.
 *
 * Auth0 does **not** put roles on API access tokens by default. Add them with a Login / Credentials Action,
 * e.g. `api.accessToken.setCustomClaim('https://yourapp.com/roles', rolesArray)`,
 * then set `AUTH0_ROLES_CLAIM` to that claim name below.
 *
 * Optional env:
 * - AUTH0_EMAIL_CLAIM — custom claim key if not using standard `email`
 * - AUTH0_ROLES_CLAIM — custom claim holding role name(s): string | string[] | { name: string }[]
 */

function pickString(payload, key) {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Normalize JWT claim payload into DB `role` string (comma‑separate when multiple).
 * @returns {string | null}
 */
export function normalizeRoleClaimValue(raw) {
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  const parts = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      parts.push(item.trim());
    } else if (item != null && typeof item === "object" && typeof item.name === "string") {
      const name = item.name.trim();
      if (name) {
        parts.push(name);
      }
    }
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Normalize roles from JWT claim into one DB `role` string (comma-separated when multiple).
 * @returns {string | null} null ⇒ caller keeps DB role / DEFAULT_NEW_USER_ROLE on insert only
 */
function rolesFromClaims(payload) {
  const claimKey = process.env.AUTH0_ROLES_CLAIM?.trim();
  if (!claimKey) {
    return null;
  }

  return normalizeRoleClaimValue(payload[claimKey]);
}

export function profileFromAuthPayload(payload) {
  const customEmailKey = process.env.AUTH0_EMAIL_CLAIM?.trim();
  const email =
    pickString(payload, "email") ||
    (customEmailKey ? pickString(payload, customEmailKey) : null);

  const firstName =
    pickString(payload, "given_name") ||
    pickString(payload, "givenName") ||
    null;
  const lastName =
    pickString(payload, "family_name") ||
    pickString(payload, "familyName") ||
    null;

  const rolesFromAuth0 = rolesFromClaims(payload);

  return { email, firstName, lastName, rolesFromAuth0 };
}
