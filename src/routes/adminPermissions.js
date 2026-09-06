import { Router } from "express";
import {
  findAllFeatures,
  findFeatureById,
  findFeatureByName,
  createFeature,
  updateFeature,
  getUserPermissions,
  grantUserFeatureAccess,
  revokeUserFeatureAccessById,
  getPermissionsOverview,
  findUserById,
} from "../db.js";
import { checkJwt, loadAppUser } from "../middleware/auth.js";
import { requireAdminRole, requirePermission } from "../middleware/permissions.js";

const router = Router();

/**
 * @openapi
 * /api/admin/features:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List all features
 *     description: Get a list of all available features in the system
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: List of features
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 features:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       is_active:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *       "401":
 *         description: Missing or invalid access token
 *       "403":
 *         description: Insufficient permissions
 */
router.get(
  "/features",
  checkJwt,
  loadAppUser,
  requirePermission("users:write", ["admin:all"]),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const features = await findAllFeatures();
      res.json({ features });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/admin/features:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Create a new feature
 *     description: Add a new feature that can be granted to users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Unique feature identifier
 *               description:
 *                 type: string
 *                 description: Human-readable description
 *               isActive:
 *                 type: boolean
 *                 description: Whether the feature is active
 *                 default: true
 *     responses:
 *       "201":
 *         description: Feature created
 *       "400":
 *         description: Invalid input
 *       "409":
 *         description: Feature with this name already exists
 */
router.post(
  "/features",
  checkJwt,
  loadAppUser,
  requirePermission("users:write", ["admin:all"]),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const { name, description, isActive } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Feature name is required",
        });
      }

      const existing = await findFeatureByName(name.trim());
      if (existing) {
        return res.status(409).json({
          error: "Conflict",
          message: "Feature with this name already exists",
        });
      }

      const feature = await createFeature(
        name.trim(),
        description?.trim() || null,
        isActive !== undefined ? Boolean(isActive) : true,
      );

      res.status(201).json({ feature });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/admin/features/{id}:
 *   patch:
 *     tags:
 *       - Admin
 *     summary: Update a feature
 *     description: Update feature name, description, or active status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       "200":
 *         description: Feature updated
 *       "404":
 *         description: Feature not found
 */
router.patch(
  "/features/:id",
  checkJwt,
  loadAppUser,
  requirePermission("users:write", ["admin:all"]),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      const existing = await findFeatureById(id);
      if (!existing) {
        return res.status(404).json({
          error: "Not Found",
          message: "Feature not found",
        });
      }

      if (name && typeof name === "string" && name.trim() !== existing.name) {
        const nameConflict = await findFeatureByName(name.trim());
        if (nameConflict) {
          return res.status(409).json({
            error: "Conflict",
            message: "Feature with this name already exists",
          });
        }
      }

      const updates = {};
      if (name && typeof name === "string" && name.trim()) {
        updates.name = name.trim();
      }
      if (description !== undefined) {
        updates.description = description?.trim() || null;
      }
      if (isActive !== undefined) {
        updates.isActive = Boolean(isActive);
      }

      const feature = await updateFeature(id, updates);
      res.json({ feature });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/admin/users/{userId}/permissions:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get user's feature permissions
 *     description: List all feature permissions granted to a specific user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: User permissions
 *       "404":
 *         description: User not found
 */
router.get(
  "/users/:userId/permissions",
  checkJwt,
  loadAppUser,
  requirePermission("users:read", ["admin:all"]),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({
          error: "Not Found",
          message: "User not found",
        });
      }

      const permissions = await getUserPermissions(userId);
      res.json({ permissions });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/admin/users/{userId}/permissions:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Grant feature access to user
 *     description: Grant a user access to a specific feature
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - featureName
 *             properties:
 *               featureName:
 *                 type: string
 *                 description: Name of the feature to grant access to
 *     responses:
 *       "200":
 *         description: Permission granted
 *       "400":
 *         description: Invalid input
 *       "404":
 *         description: User or feature not found
 */
router.post(
  "/users/:userId/permissions",
  checkJwt,
  loadAppUser,
  requirePermission("users:write", ["admin:all"]),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { featureName } = req.body;

      if (!featureName || typeof featureName !== "string" || !featureName.trim()) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Feature name is required",
        });
      }

      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({
          error: "Not Found",
          message: "User not found",
        });
      }

      const feature = await findFeatureByName(featureName.trim());
      if (!feature) {
        return res.status(404).json({
          error: "Not Found",
          message: "Feature not found",
        });
      }

      const permission = await grantUserFeatureAccess(
        userId,
        featureName.trim(),
        req.appUser.id,
      );

      res.json({ permission });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/admin/users/{userId}/permissions/{featureId}:
 *   delete:
 *     tags:
 *       - Admin
 *     summary: Revoke feature access from user
 *     description: Remove a user's access to a specific feature
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: featureId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Permission revoked
 *       "404":
 *         description: User, feature, or permission not found
 */
router.delete(
  "/users/:userId/permissions/:featureId",
  checkJwt,
  loadAppUser,
  requirePermission("users:write", ["admin:all"]),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const { userId, featureId } = req.params;

      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({
          error: "Not Found",
          message: "User not found",
        });
      }

      const feature = await findFeatureById(featureId);
      if (!feature) {
        return res.status(404).json({
          error: "Not Found",
          message: "Feature not found",
        });
      }

      const deleted = await revokeUserFeatureAccessById(userId, featureId);
      if (!deleted) {
        return res.status(404).json({
          error: "Not Found",
          message: "Permission not found",
        });
      }

      res.json({ ok: true, message: "Permission revoked" });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/admin/permissions/overview:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get permissions overview
 *     description: Get a matrix view of all users and their feature permissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Permissions overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overview:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id:
 *                         type: string
 *                       email:
 *                         type: string
 *                       role:
 *                         type: string
 *                       status:
 *                         type: string
 *                       permissions:
 *                         type: array
 */
router.get(
  "/permissions/overview",
  checkJwt,
  loadAppUser,
  requirePermission("users:read", ["admin:all"]),
  requireAdminRole,
  async (req, res, next) => {
    try {
      const overview = await getPermissionsOverview();
      res.json({ overview });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
