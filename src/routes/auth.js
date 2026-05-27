import { Router } from "express";
import { checkJwt, loadAppUser } from "../middleware/auth.js";
import { syncUserOnLogin } from "../middleware/syncUserOnLogin.js";
import { toSafeUserProfile } from "../db.js";

const router = Router();

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Current approved user profile
 *     description: |
 *       Validates Auth0 JWT, upserts Neon user + **last_login_at** (UK-formatted in response),
 *       then requires **active** status. New users are created as `pending` until an admin activates them.
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
 *       "400":
 *         description: First login without email claim on access token
 *       "401":
 *         description: Missing or invalid access token
 *       "403":
 *         description: User exists but is not active
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
 * 3. User must be **active** in Neon (loadAppUser).
 * 4. Returns only safe profile fields for the frontend.
 *
 * No passwords or registration are handled here.
 */
router.get("/me", checkJwt, syncUserOnLogin, loadAppUser, (req, res) => {
  // Identity from Auth0 (req.auth.payload.sub / .permissions); approval from Neon (req.appUser).
  res.json({
    user: toSafeUserProfile(req.appUser),
  });
});

export default router;
