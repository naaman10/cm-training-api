import "../loadEnv.js";
import { auth } from "express-oauth2-jwt-bearer";
import { isBlockedAccountStatus } from "../auth/accountStatus.js";
import { findUserByAuth0Id } from "../db.js";

/**
 * Auth0 validates identity: verifies the access token signature, issuer, and audience.
 * Public sign-up is disabled in Auth0; this middleware only proves who the caller is.
 */
export const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  audience: process.env.AUTH0_AUDIENCE,
});

/**
 * After JWT validation, Neon must have (or GET /api/auth/me just created via sync) a profile row.
 * 403 Forbidden is reserved only for admins explicitly marking an account suspended or blocked — not for pending/inactive.
 */
export async function loadAppUser(req, res, next) {
  try {
    const auth0UserId = req.auth?.payload?.sub;
    if (!auth0UserId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing authenticated subject",
      });
    }

    const user = await findUserByAuth0Id(auth0UserId);

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User profile not found",
      });
    }

    if (isBlockedAccountStatus(user.status)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Account suspended or blocked",
      });
    }

    req.appUser = user;
    next();
  } catch (error) {
    next(error);
  }
}
