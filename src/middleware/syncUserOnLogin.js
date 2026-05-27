import { profileFromAuthPayload } from "../auth/profileFromToken.js";
import { upsertUserOnLogin } from "../db.js";

/**
 * Runs on "login bootstrap" (GET /api/auth/me): upserts Neon row from Auth0 claims
 * and sets last_login_at. loadAppUser denies only suspended/blocked accounts (403).
 */
export async function syncUserOnLogin(req, res, next) {
  try {
    const auth0UserId = req.auth?.payload?.sub;
    if (!auth0UserId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing authenticated subject",
      });
    }

    const profile = profileFromAuthPayload(req.auth.payload);
    const result = await upsertUserOnLogin(auth0UserId, profile);

    if (!result.ok) {
      if (result.code === "MISSING_EMAIL") {
        return res.status(400).json({
          error: "Bad Request",
          message:
            "First login requires an email claim on the access token. Add an Auth0 Action to copy `email` into the access token for this API audience.",
        });
      }
      if (result.code === "EMAIL_CONFLICT") {
        return res.status(409).json({
          error: "Conflict",
          message:
            "This email is already linked to another account. Contact an administrator.",
        });
      }
      return res.status(500).json({
        error: "Internal Server Error",
        message: "User sync failed",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}
