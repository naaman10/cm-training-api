import { Router } from "express";
import { findAllUsers, toSafeAdminUser } from "../db.js";
import { checkJwt, loadAppUser } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";

const router = Router();

/**
 * GET /api/admin/users
 *
 * Example admin route: Auth0 identity + active app user + users:read permission.
 */
router.get(
  "/users",
  checkJwt,
  loadAppUser,
  requirePermission("users:read"),
  async (req, res, next) => {
    try {
      const users = await findAllUsers();
      res.json({
        users: users.map(toSafeAdminUser),
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
