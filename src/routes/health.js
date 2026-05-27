import { Router } from "express";

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Liveness probe
 *     responses:
 *       "200":
 *         description: Service is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
