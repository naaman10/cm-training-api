import { Router } from "express";
import {
  createUser,
  findAllUsers,
  findUserById,
  toSafeAdminUser,
  updateUserById,
} from "../db.js";
import {
  auth0CreateUser,
  auth0DeleteUser,
  auth0TriggerPasswordReset,
  auth0UpdateUser,
} from "../auth/auth0Management.js";
import { checkJwt, loadAppUser } from "../middleware/auth.js";
import { requireAdminRole, requirePermission } from "../middleware/permissions.js";

const router = Router();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value) {
  return typeof value === "string" && emailRegex.test(value.trim());
}

function validateRequiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

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
  requireAdminRole,
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

router.post(
  "/users",
  checkJwt,
  loadAppUser,
  requirePermission("users:write"),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const { email, firstName, lastName, role } = req.body ?? {};
      if (!validateEmail(email) || !validateRequiredString(role)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Valid email and role are required",
        });
      }

      const auth0User = await auth0CreateUser({
        email: email.trim(),
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
      });

      try {
        const user = await createUser({
          auth0UserId: auth0User.user_id,
          email: email.trim(),
          firstName: firstName?.trim() || null,
          lastName: lastName?.trim() || null,
          role: role.trim(),
          status: "active",
        });

        return res.status(201).json({ user: toSafeAdminUser(user) });
      } catch (dbError) {
        await auth0DeleteUser(auth0User.user_id);
        throw dbError;
      }
    } catch (error) {
      if (error.status === 409) {
        return res.status(409).json({
          error: "Conflict",
          message: "User with this email already exists",
        });
      }
      next(error);
    }
  },
);

router.patch(
  "/users/:id",
  checkJwt,
  loadAppUser,
  requirePermission("users:write"),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const existing = await findUserById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          error: "Not Found",
          message: "User not found",
        });
      }

      const { email, firstName, lastName, role } = req.body ?? {};
      if (email != null && !validateEmail(email)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Email is invalid",
        });
      }
      if (role != null && !validateRequiredString(role)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Role must be a non-empty string",
        });
      }

      await auth0UpdateUser(existing.auth0_user_id, {
        email: email?.trim(),
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
      });

      const updated = await updateUserById(req.params.id, {
        email: email?.trim(),
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        role: role?.trim(),
      });

      return res.json({ user: toSafeAdminUser(updated) });
    } catch (error) {
      if (error.status === 409) {
        return res.status(409).json({
          error: "Conflict",
          message: "User with this email already exists",
        });
      }
      next(error);
    }
  },
);

router.post(
  "/users/:id/deactivate",
  checkJwt,
  loadAppUser,
  requirePermission("users:write"),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const existing = await findUserById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          error: "Not Found",
          message: "User not found",
        });
      }

      await auth0UpdateUser(existing.auth0_user_id, { blocked: true });
      const updated = await updateUserById(req.params.id, { status: "inactive" });
      return res.json({ user: toSafeAdminUser(updated) });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/users/:id/password-reset",
  checkJwt,
  loadAppUser,
  requirePermission("users:write"),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const existing = await findUserById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          error: "Not Found",
          message: "User not found",
        });
      }

      await auth0TriggerPasswordReset(existing.email);
      await updateUserById(req.params.id, {});
      return res.status(202).json({
        ok: true,
        message: "Password reset requested",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
