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
