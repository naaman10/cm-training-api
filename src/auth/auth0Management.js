const MANAGEMENT_TOKEN_GRANT = "client_credentials";

let cachedToken = null;
let cachedTokenExpiresAtMs = 0;

function managementAudience() {
  return `https://${process.env.AUTH0_DOMAIN}/api/v2/`;
}

async function auth0Request(path, options = {}) {
  const response = await fetch(`https://${process.env.AUTH0_DOMAIN}${path}`, options);
  if (response.ok) {
    return response;
  }

  let details = null;
  try {
    details = await response.json();
  } catch {
    details = null;
  }

  const message = details?.message || details?.error_description || response.statusText;
  const error = new Error(`Auth0 request failed (${response.status}): ${message}`);
  error.status = response.status;
  error.details = details;
  throw error;
}

export async function getManagementToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAtMs - 30_000) {
    return cachedToken;
  }

  const response = await auth0Request("/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.AUTH0_M2M_CLIENT_ID,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
      audience: managementAudience(),
      grant_type: MANAGEMENT_TOKEN_GRANT,
    }),
  });

  const data = await response.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAtMs = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return cachedToken;
}

async function managementApi(path, options = {}) {
  const token = await getManagementToken();
  return auth0Request(`/api/v2${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export async function auth0CreateUser({ email, firstName, lastName }) {
  const response = await managementApi("/users", {
    method: "POST",
    body: JSON.stringify({
      connection: process.env.AUTH0_DB_CONNECTION,
      email,
      given_name: firstName || undefined,
      family_name: lastName || undefined,
      email_verified: false,
      verify_email: true,
    }),
  });
  return response.json();
}

export async function auth0UpdateUser(auth0UserId, updates) {
  const response = await managementApi(`/users/${encodeURIComponent(auth0UserId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      email: updates.email,
      given_name: updates.firstName,
      family_name: updates.lastName,
      blocked: updates.blocked,
    }),
  });
  return response.json();
}

export async function auth0DeleteUser(auth0UserId) {
  await managementApi(`/users/${encodeURIComponent(auth0UserId)}`, {
    method: "DELETE",
  });
}

export async function auth0TriggerPasswordReset(email) {
  const response = await auth0Request("/dbconnections/change_password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.AUTH0_M2M_CLIENT_ID,
      email,
      connection: process.env.AUTH0_DB_CONNECTION,
    }),
  });
  return response.text();
}
