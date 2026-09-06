/**
 * Render API enforces permissions: required scopes come from Auth0 RBAC on the token,
 * not from the frontend. Never trust client-sent roles or permission claims outside the JWT.
 *
 * @param {string} permission Auth0 API permission (e.g. "users:read")
 * @param {string[]} [fallbackPermissions] Optional alternatives (e.g. ["admin:all"])
 */
export function requirePermission(permission, fallbackPermissions = []) {
  return (req, res, next) => {
    const tokenPermissions = req.auth?.payload?.permissions;
    const allowedPermissions = [permission, ...fallbackPermissions];

    if (
      !Array.isArray(tokenPermissions) ||
      !allowedPermissions.some((allowed) => tokenPermissions.includes(allowed))
    ) {
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

/**
 * Check if user has access to a specific feature.
 * Admins automatically bypass all feature checks.
 * 
 * @param {string} featureName The feature name to check (e.g., "reports", "social:create")
 */
export function requireFeatureAccess(featureName) {
  return async (req, res, next) => {
    const role = req.appUser?.role;
    
    // Admins bypass all feature checks
    if (typeof role === "string") {
      const roles = role
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      
      if (roles.includes("admin")) {
        return next();
      }
    }

    // Check if user has permission for this feature
    try {
      const { checkUserFeatureAccess } = await import("../db.js");
      const hasAccess = await checkUserFeatureAccess(req.appUser.id, featureName);
      
      if (!hasAccess) {
        return res.status(403).json({
          error: "Forbidden",
          message: `Access to ${featureName} feature is not granted`,
        });
      }
      
      next();
    } catch (error) {
      console.error("[requireFeatureAccess] error checking feature access", {
        userId: req.appUser?.id,
        featureName,
        error: error.message,
      });
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to check feature access",
      });
    }
  };
}
