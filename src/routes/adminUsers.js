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
const CREATE_ALLOWED_FIELDS = new Set(["email", "firstName", "lastName", "role"]);

function validateEmail(value) {
  return typeof value === "string" && emailRegex.test(value.trim());
}

function validateRequiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeCreateBodyForLog(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { bodyType: typeof body };
  }
  const raw = /** @type {Record<string, unknown>} */ (body);
  return {
    keys: Object.keys(raw),
    email: typeof raw.email === "string" ? raw.email.trim() : raw.email,
    firstName: typeof raw.firstName === "string" ? raw.firstName.trim() : raw.firstName,
    lastName: typeof raw.lastName === "string" ? raw.lastName.trim() : raw.lastName,
    role: typeof raw.role === "string" ? raw.role.trim() : raw.role,
  };
}

function hasOnlyCreateBodyFields(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  return Object.keys(body).every((key) => CREATE_ALLOWED_FIELDS.has(key));
}

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List users (requires permission)
 *     description: |
 *       Server-side RBAC only: JWT must include `users:read` or `admin:all` in **permissions**.
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
 *         description: Inactive user or missing `users:read`/`admin:all` permission
 *       "500":
 *         description: Database or server error
 */
router.get(
  "/users",
  checkJwt,
  loadAppUser,
  requirePermission("users:read", ["admin:all"]),
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
  requirePermission("users:write", ["admin:all"]),
  requireAdminRole,
  async (req, res, next) => {
    try {
      console.debug(
        "[admin-users:create] incoming body",
        sanitizeCreateBodyForLog(req.body),
      );

      if (!hasOnlyCreateBodyFields(req.body)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Request body must only include email, firstName, lastName, and role",
        });
      }

      const { email, firstName, lastName, role } = req.body;
      if (!validateEmail(email) || !validateRequiredString(role)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Valid email and role are required",
        });
      }

      const auth0Payload = {
        email: email.trim(),
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
      };
      console.debug("[admin-users:create] auth0 payload", auth0Payload);

      const auth0User = await auth0CreateUser({
        email: auth0Payload.email,
        firstName: auth0Payload.firstName,
        lastName: auth0Payload.lastName,
      });

      try {
        const user = await createUser({
          auth0UserId: auth0User.user_id,
          email: auth0Payload.email,
          firstName: auth0Payload.firstName,
          lastName: auth0Payload.lastName,
          role: role.trim(),
          status: "active",
        });

        return res.status(201).json({ user: toSafeAdminUser(user) });
      } catch (dbError) {
        try {
          await auth0DeleteUser(auth0User.user_id);
        } catch (cleanupError) {
          console.error("[admin-users:create] auth0 cleanup failed", {
            message: cleanupError.message,
            status: cleanupError.status,
            details: cleanupError.details,
          });
        }
        throw dbError;
      }
    } catch (error) {
      console.error("[admin-users:create] create failed", {
        message: error.message,
        status: error.status,
        details: error.details,
      });
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
  requirePermission("users:write", ["admin:all"]),
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
  requirePermission("users:write", ["admin:all"]),
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
  requirePermission("users:write", ["admin:all"]),
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
