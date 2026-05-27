import { Router } from "express";
import { findAllUsers, toSafeAdminUser } from "../db.js";
import { checkJwt, loadAppUser } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";

const router = Router();

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List users (requires permission)
 *     description: |
 *       Server-side RBAC only: JWT must include `users:read` in **permissions**.
 *       Caller must also be an approved **active** app user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: User list with status fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SafeAdminUser'
 *       "401":
 *         description: Missing or invalid access token
 *       "403":
 *         description: Inactive user or missing `users:read` permission
 *       "500":
 *         description: Database or server error
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
