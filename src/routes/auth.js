import { Router } from "express";
import { checkJwt, loadAppUser } from "../middleware/auth.js";
import { toSafeUserProfile } from "../db.js";

const router = Router();

/**
 * GET /api/auth/me
 *
 * Login/session bootstrap for the training portal:
 * 1. Auth0 access token proves identity (checkJwt).
 * 2. Neon row proves the user was created by an admin and approved (loadAppUser).
 * 3. Returns only safe profile fields for the frontend.
 *
 * No passwords or registration are handled here.
 */
router.get("/me", checkJwt, loadAppUser, (req, res) => {
  // Identity from Auth0 (req.auth.payload.sub / .permissions); approval from Neon (req.appUser).
  res.json({
    user: toSafeUserProfile(req.appUser),
  });
});

export default router;
