/**
 * Pull profile fields from Auth0 access token claims.
 * Configure Auth0 (Actions) to add `email` (and optionally names) to the access token for your API audience.
 *
 * Optional env: AUTH0_EMAIL_CLAIM — dotless custom claim key, e.g. `https://yourapp.com/email`
 */

function pickString(payload, key) {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
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

  return { email, firstName, lastName };
}
