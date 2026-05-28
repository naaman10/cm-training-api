import { managementApi } from "./auth0Management.js";
import { parseRoleNamesFromDbRole } from "./roleNames.js";

/** @type {Map<string, { id: string, name: string }> | null} */
let rolesByLowerName = null;
let rolesCacheExpiresAtMs = 0;

async function getAuth0RolesByName() {
  const now = Date.now();
  if (rolesByLowerName && now < rolesCacheExpiresAtMs) {
    return rolesByLowerName;
  }

  const response = await managementApi("/roles?per_page=100");
  const roles = await response.json();
  const map = new Map();
  for (const role of roles) {
    if (typeof role?.name === "string" && typeof role?.id === "string") {
      map.set(role.name.trim().toLowerCase(), { id: role.id, name: role.name });
    }
  }
  rolesByLowerName = map;
  rolesCacheExpiresAtMs = now + 5 * 60 * 1000;
  return map;
}

/**
 * @param {string} auth0UserId
 */
async function auth0GetUserRoles(auth0UserId) {
  const response = await managementApi(
    `/users/${encodeURIComponent(auth0UserId)}/roles?per_page=100`,
  );
  return response.json();
}

/**
 * Align Auth0 RBAC role assignments with the Neon/API role string.
 * Role names are matched case-insensitively to Auth0 role `name`.
 *
 * @param {string} auth0UserId
 * @param {string} roleString Comma-separated role names (same format as Neon `users.role`)
 */
export async function auth0SyncUserRoles(auth0UserId, roleString) {
  const desiredNames = parseRoleNamesFromDbRole(roleString);
  const catalog = await getAuth0RolesByName();

  /** @type {{ id: string, name: string }[]} */
  const desiredRoles = [];
  for (const name of desiredNames) {
    const match = catalog.get(name.toLowerCase());
    if (!match) {
      const error = new Error(`Unknown Auth0 role: ${name}`);
      error.status = 400;
      throw error;
    }
    desiredRoles.push(match);
  }

  const current = await auth0GetUserRoles(auth0UserId);
  const currentList = Array.isArray(current) ? current : [];
  const desiredIds = new Set(desiredRoles.map((r) => r.id));
  const currentIds = new Set(
    currentList.filter((r) => typeof r?.id === "string").map((r) => r.id),
  );

  const toRemove = currentList
    .filter((r) => typeof r?.id === "string" && !desiredIds.has(r.id))
    .map((r) => r.id);
  const toAdd = desiredRoles.filter((r) => !currentIds.has(r.id)).map((r) => r.id);

  const encodedId = encodeURIComponent(auth0UserId);

  if (toRemove.length > 0) {
    await managementApi(`/users/${encodedId}/roles`, {
      method: "DELETE",
      body: JSON.stringify({ roles: toRemove }),
    });
  }

  if (toAdd.length > 0) {
    await managementApi(`/users/${encodedId}/roles`, {
      method: "POST",
      body: JSON.stringify({ roles: toAdd }),
    });
  }
}
