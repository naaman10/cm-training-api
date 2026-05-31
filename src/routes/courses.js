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
import {
  completeCourseEnrollment,
  createCourseEnrollment,
  findEnrollmentByUserAndCourse,
  findEnrollmentsByUserId,
  toSafeEnrollment,
} from "../db.js";
import { attachEnrollmentToCourse } from "../enrollments/enrollmentStatus.js";
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

/**
 * @param {string} courseId
 * @param {{ role?: unknown }} appUser
 */
async function loadAccessibleCourse(courseId, appUser) {
  const entry = await fetchCourseById(courseId);
  const userRoles = getUserRoles(appUser);
  if (!userCanAccessCourse(userRoles, entry.fields?.courseRole)) {
    return null;
  }
  return entry;
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

function handleEnrollmentDbError(error, res, next) {
  if (error.code === "23505") {
    return res.status(409).json({
      error: "Conflict",
      message: "Already enrolled in this course",
    });
  }
  if (error.code === "42P01") {
    return res.status(503).json({
      error: "Service Unavailable",
      message: "Course enrollments are not available. Run database migrations.",
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
 *       Users with **admin** in their role receive all courses. Each course includes **enrollmentStatus**
 *       (`available`, `enrolled`, or `completed`).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Filtered course list with enrollment status
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
    const [entries, enrollmentMap] = await Promise.all([
      fetchAllCourses(),
      findEnrollmentsByUserId(req.appUser.id),
    ]);
    const accessible = filterAccessibleCourses(entries, req.appUser);
    res.json({
      courses: accessible.map((entry) =>
        attachEnrollmentToCourse(
          mapCourseSummary(entry),
          enrollmentMap[entry.sys.id],
        ),
      ),
    });
  } catch (error) {
    handleContentfulError(error, res, next);
  }
});

/**
 * @openapi
 * /api/courses/{courseId}/enroll:
 *   post:
 *     tags:
 *       - Courses
 *     summary: Enroll in a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "201":
 *         description: Enrolled
 *       "401":
 *         description: Unauthorized
 *       "403":
 *         description: Account suspended or blocked
 *       "404":
 *         description: Course not found or not accessible
 *       "409":
 *         description: Already enrolled
 *       "503":
 *         description: Contentful or database unavailable
 */
router.post(
  "/:courseId/enroll",
  checkJwt,
  loadAppUser,
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      const entry = await loadAccessibleCourse(courseId, req.appUser);
      if (!entry) {
        return res.status(404).json({
          error: "Not Found",
          message: "Course not found",
        });
      }

      const row = await createCourseEnrollment(req.appUser.id, courseId);
      return res.status(201).json({ enrollment: toSafeEnrollment(row) });
    } catch (error) {
      if (error?.sys?.id === "NotFound") {
        return res.status(404).json({
          error: "Not Found",
          message: "Course not found",
        });
      }
      if (
        error instanceof ContentfulNotConfiguredError ||
        error.status === 503
      ) {
        return handleContentfulError(error, res, next);
      }
      return handleEnrollmentDbError(error, res, next);
    }
  },
);

/**
 * @openapi
 * /api/courses/{courseId}/complete:
 *   post:
 *     tags:
 *       - Courses
 *     summary: Mark a course as completed
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Course marked complete (idempotent if already completed)
 *       "401":
 *         description: Unauthorized
 *       "403":
 *         description: Account suspended or blocked
 *       "404":
 *         description: Course not found or not enrolled
 *       "503":
 *         description: Contentful or database unavailable
 */
router.post(
  "/:courseId/complete",
  checkJwt,
  loadAppUser,
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      const entry = await loadAccessibleCourse(courseId, req.appUser);
      if (!entry) {
        return res.status(404).json({
          error: "Not Found",
          message: "Course not found",
        });
      }

      const existing = await findEnrollmentByUserAndCourse(
        req.appUser.id,
        courseId,
      );
      if (!existing) {
        return res.status(404).json({
          error: "Not Found",
          message: "Enrollment not found",
        });
      }

      const row = await completeCourseEnrollment(req.appUser.id, courseId);
      return res.status(200).json({ enrollment: toSafeEnrollment(row) });
    } catch (error) {
      if (error?.sys?.id === "NotFound") {
        return res.status(404).json({
          error: "Not Found",
          message: "Course not found",
        });
      }
      if (
        error instanceof ContentfulNotConfiguredError ||
        error.status === 503
      ) {
        return handleContentfulError(error, res, next);
      }
      return handleEnrollmentDbError(error, res, next);
    }
  },
);

/**
 * @openapi
 * /api/courses/{id}:
 *   get:
 *     tags:
 *       - Courses
 *     summary: Get course detail
 *     description: |
 *       Returns a single course with prerequisites and enrollment status.
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

    const enrollment = await findEnrollmentByUserAndCourse(
      req.appUser.id,
      entry.sys.id,
    );
    res.json({
      course: attachEnrollmentToCourse(mapCourseDetail(entry), enrollment),
    });
  } catch (error) {
    handleContentfulError(error, res, next);
  }
});

export default router;
