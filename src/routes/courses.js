import { Router } from "express";
import {
  getUserRoles,
  userCanAccessCourse,
} from "../contentful/courseRole.js";
import {
  ContentfulNotConfiguredError,
  fetchAllCourses,
  fetchCourseById,
} from "../contentful/fetchCourses.js";
import { mapCourseDetail, mapCourseSummary } from "../contentful/mapCourse.js";
import { checkJwt, loadAppUser } from "../middleware/auth.js";

const router = Router();

/**
 * @param {import('contentful').Entry[]} entries
 * @param {{ role?: unknown }} appUser
 */
function filterAccessibleCourses(entries, appUser) {
  const userRoles = getUserRoles(appUser);
  return entries.filter((entry) =>
    userCanAccessCourse(userRoles, entry.fields?.courseRole),
  );
}

function handleContentfulError(error, res, next) {
  if (error instanceof ContentfulNotConfiguredError || error.status === 503) {
    return res.status(503).json({
      error: "Service Unavailable",
      message: error.message,
    });
  }
  if (error?.sys?.id === "NotFound") {
    return res.status(404).json({
      error: "Not Found",
      message: "Course not found",
    });
  }
  next(error);
}

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags:
 *       - Courses
 *     summary: List courses for the authenticated user
 *     description: |
 *       Returns published Contentful courses whose **courseRole** matches the caller's Neon role.
 *       Users with **admin** in their role receive all courses. Includes **lessonCount** only (no lesson content).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Filtered course list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 courses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SafeCourseSummary'
 *       "401":
 *         description: Missing or invalid access token
 *       "403":
 *         description: Account suspended or blocked
 *       "404":
 *         description: User profile not found
 *       "503":
 *         description: Contentful not configured
 */
router.get("/", checkJwt, loadAppUser, async (req, res, next) => {
  try {
    const entries = await fetchAllCourses();
    const accessible = filterAccessibleCourses(entries, req.appUser);
    res.json({
      courses: accessible.map(mapCourseSummary),
    });
  } catch (error) {
    handleContentfulError(error, res, next);
  }
});

/**
 * @openapi
 * /api/courses/{id}:
 *   get:
 *     tags:
 *       - Courses
 *     summary: Get course detail
 *     description: |
 *       Returns a single course with prerequisites. **lessonCount** is included; lesson entries are not returned.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Contentful course entry id
 *     responses:
 *       "200":
 *         description: Course detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 course:
 *                   $ref: '#/components/schemas/SafeCourseDetail'
 *       "401":
 *         description: Missing or invalid access token
 *       "403":
 *         description: Account suspended or blocked
 *       "404":
 *         description: Course not found or not accessible
 *       "503":
 *         description: Contentful not configured
 */
router.get("/:id", checkJwt, loadAppUser, async (req, res, next) => {
  try {
    const entry = await fetchCourseById(req.params.id);
    const userRoles = getUserRoles(req.appUser);
    if (!userCanAccessCourse(userRoles, entry.fields?.courseRole)) {
      return res.status(404).json({
        error: "Not Found",
        message: "Course not found",
      });
    }
    res.json({ course: mapCourseDetail(entry) });
  } catch (error) {
    handleContentfulError(error, res, next);
  }
});

export default router;
