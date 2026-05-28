/**
 * Render API enforces permissions: required scopes come from Auth0 RBAC on the token,
 * not from the frontend. Never trust client-sent roles or permission claims outside the JWT.
 *
 * @param {string} permission Auth0 API permission (e.g. "users:read")
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    const tokenPermissions = req.auth?.payload?.permissions;

    if (!Array.isArray(tokenPermissions) || !tokenPermissions.includes(permission)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Insufficient permissions",
      });
    }

    next();
  };
}

export function requireAdminRole(req, res, next) {
  const role = req.appUser?.role;
  if (typeof role !== "string") {
    return res.status(403).json({
      error: "Forbidden",
      message: "Admin role required",
    });
  }

  const roles = role
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!roles.includes("admin")) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Admin role required",
    });
  }

  next();
}
