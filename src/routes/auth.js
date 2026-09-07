import { Router } from "express";
import { checkJwt, loadAppUser } from "../middleware/auth.js";
import { syncUserOnLogin } from "../middleware/syncUserOnLogin.js";
import { profileFromAuthPayload } from "../auth/profileFromToken.js";
import { toSafeUserProfile, getUserPermissions } from "../db.js";

const router = Router();

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Current approved user profile
 *     description: |
 *       Validates Auth0 JWT, upserts Neon user + **last_login_at** (UK-formatted in response).
 *       Returns 200 whenever the profile row exists unless status is **suspended** or **blocked**.
 *       Does not expose `auth0_user_id`; returns profile only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Active user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/SafeUserProfile'
 *                 auth0RoleClaim:
 *                   type: string
 *                   nullable: true
 *                   description: JWT claim key inspected for roles (`AUTH0_ROLES_CLAIM`)
 *                 auth0RoleFromToken:
 *                   type: string
 *                   nullable: true
 *                   description: Normalized role value parsed from the JWT claim
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of feature names the user has access to (empty for non-admin users with no grants; admin users have implicit access to all features)
 *                 isAdmin:
 *                   type: boolean
 *                   description: Whether the user has admin role (admins have access to all features)
 *       "400":
 *         description: First login without email claim on access token
 *       "401":
 *         description: Missing or invalid access token
 *       "403":
 *         description: Account suspended or blocked by admin
 *       "404":
 *         description: No Neon profile for this Auth0 subject
 *       "409":
 *         description: Email already used by another Auth0 user
 */

/**
 * GET /api/auth/me
 *
 * Login/session bootstrap for the training portal:
 * 1. Auth0 access token proves identity (checkJwt).
 * 2. Neon row is upserted from token claims; **last_login_at** is set (syncUserOnLogin).
 * 3. loadAppUser blocks only **suspended** / **blocked** accounts (403).
 * 4. Returns safe profile fields + feature permissions for the frontend.
 *
 * No passwords or registration are handled here.
 */
router.get("/me", checkJwt, syncUserOnLogin, loadAppUser, async (req, res) => {
  // Identity from Auth0 (req.auth.payload.sub / .permissions); approval from Neon (req.appUser).
  const parsed = profileFromAuthPayload(req.auth?.payload ?? {});

  // Check if user is admin
  const userRole = req.appUser?.role || "";
  const roles = userRole.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
  const isAdmin = roles.includes("admin");

  // Get user's feature permissions
  // Admins have implicit access to all features, but we still return their explicit grants
  const userPermissions = await getUserPermissions(req.appUser.id);
  const permissions = userPermissions
    .filter((p) => p.feature_is_active) // Only return active features
    .map((p) => p.feature_name);

  res.json({
    user: toSafeUserProfile(req.appUser),
    auth0RoleClaim: process.env.AUTH0_ROLES_CLAIM ?? null,
    auth0RoleFromToken: parsed.rolesFromAuth0,
    permissions,
    isAdmin,
  });
});

export default router;
