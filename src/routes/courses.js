import { Router } from "express";
import {
  getUserRoles,
  userCanAccessCourse,
} from "../contentful/courseRole.js";
import {
  ContentfulNotConfiguredError,
  fetchAllCourses,
  fetchCourseById,
  fetchCourseBySlug,
} from "../contentful/fetchCourses.js";
import { mapCourseDetail, mapCourseSummary } from "../contentful/mapCourse.js";
import { isValidAnswerForLessonQuestion } from "../contentful/mapLesson.js";
import {
  completeCourseEnrollment,
  countLessonAnswersByCourse,
  createCourseEnrollment,
  createOrGetLessonProgress,
  findEnrollmentByUserAndCourse,
  findEnrollmentsByUserId,
  findLessonProgressByUserAndCourse,
  toSafeEnrollment,
  upsertLessonQuestionAnswer,
} from "../db.js";
import { attachEnrollmentToCourse } from "../enrollments/enrollmentStatus.js";
import { loadLessonForEnrolledUser } from "../lessons/courseLessonAccess.js";
import { buildLessonResponse } from "../lessons/lessonResponse.js";
import { attachLessonProgressToCourse } from "../lessons/lessonStatus.js";
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

function handleLessonProgressDbError(error, res, next) {
  if (error.code === "42P01") {
    return res.status(503).json({
      error: "Service Unavailable",
      message: "Lesson progress is not available. Run database migrations.",
    });
  }
  next(error);
}

/**
 * @param {{ error?: string }} result
 * @param {import('express').Response} res
 */
function respondLessonAccessError(result, res) {
  if (result.error === "course_not_found") {
    return res.status(404).json({
      error: "Not Found",
      message: "Course not found",
    });
  }
  if (result.error === "not_enrolled") {
    return res.status(404).json({
      error: "Not Found",
      message: "Enrollment not found",
    });
  }
  if (result.error === "lesson_not_found") {
    return res.status(404).json({
      error: "Not Found",
      message: "Lesson not found",
    });
  }
  return null;
}

/**
 * @param {import('contentful').Entry} entry
 * @param {string} userId
 */
async function mapCourseDetailWithLessonProgress(entry, userId) {
  const detail = mapCourseDetail(entry);
  const [progressMap, answeredCountMap] = await Promise.all([
    findLessonProgressByUserAndCourse(userId, entry.sys.id),
    countLessonAnswersByCourse(userId, entry.sys.id),
  ]);
  return attachLessonProgressToCourse(
    detail,
    progressMap,
    answeredCountMap,
    entry,
  );
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
/**
 * @openapi
 * /api/courses/by-slug/{courseSlug}:
 *   get:
 *     tags:
 *       - Courses
 *     summary: Get course detail by courseSlug
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseSlug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Course detail
 *       "404":
 *         description: Course not found or not accessible
 */
router.get("/by-slug/:courseSlug", checkJwt, loadAppUser, async (req, res, next) => {
  try {
    const courseSlug = req.params.courseSlug?.trim();
    if (!courseSlug) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Course slug is required",
      });
    }

    const entry = await fetchCourseBySlug(courseSlug);
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
    const detail = await mapCourseDetailWithLessonProgress(
      entry,
      req.appUser.id,
    );
    res.json({
      course: attachEnrollmentToCourse(detail, enrollment),
    });
  } catch (error) {
    if (error.code === "42P01") {
      return handleLessonProgressDbError(error, res, next);
    }
    handleContentfulError(error, res, next);
  }
});

/**
 * @openapi
 * /api/courses/{courseId}/lessons/{lessonId}:
 *   get:
 *     tags:
 *       - Courses
 *     summary: Get lesson detail for an enrolled user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Lesson content with progress status
 *       "404":
 *         description: Course, lesson, or enrollment not found
 *       "503":
 *         description: Contentful or database unavailable
 */
router.get(
  "/:courseId/lessons/:lessonId",
  checkJwt,
  loadAppUser,
  async (req, res, next) => {
    try {
      const { courseId, lessonId } = req.params;
      const loaded = await loadLessonForEnrolledUser(
        courseId,
        lessonId,
        req.appUser,
        { include: 4 },
      );
      const accessError = respondLessonAccessError(loaded, res);
      if (accessError) {
        return accessError;
      }

      const body = await buildLessonResponse(
        req.appUser.id,
        courseId,
        lessonId,
        loaded.lesson,
      );

      res.json(body);
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
      return handleLessonProgressDbError(error, res, next);
    }
  },
);

/**
 * @openapi
 * /api/courses/{courseId}/lessons/{lessonId}/start:
 *   post:
 *     tags:
 *       - Courses
 *     summary: Start a lesson (idempotent)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "201":
 *         description: Lesson started for the first time
 *       "200":
 *         description: Lesson was already started
 *       "404":
 *         description: Course, lesson, or enrollment not found
 *       "503":
 *         description: Contentful or database unavailable
 */
router.post(
  "/:courseId/lessons/:lessonId/start",
  checkJwt,
  loadAppUser,
  async (req, res, next) => {
    try {
      const { courseId, lessonId } = req.params;
      const loaded = await loadLessonForEnrolledUser(
        courseId,
        lessonId,
        req.appUser,
        { include: 4 },
      );
      const accessError = respondLessonAccessError(loaded, res);
      if (accessError) {
        return accessError;
      }

      const { row, created } = await createOrGetLessonProgress(
        req.appUser.id,
        courseId,
        lessonId,
      );

      const body = await buildLessonResponse(
        req.appUser.id,
        courseId,
        lessonId,
        loaded.lesson,
        row,
      );

      return res.status(created ? 201 : 200).json(body);
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
      return handleLessonProgressDbError(error, res, next);
    }
  },
);

/**
 * @openapi
 * /api/courses/{courseId}/lessons/{lessonId}/answers:
 *   post:
 *     tags:
 *       - Courses
 *     summary: Save the user's answer for a lesson question
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: lessonId
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
 *               - questionId
 *               - answerId
 *             properties:
 *               questionId:
 *                 type: string
 *               answerId:
 *                 type: string
 *     responses:
 *       "201":
 *         description: Answer saved for the first time for this question
 *       "200":
 *         description: Answer updated or unchanged
 *       "400":
 *         description: Invalid question or answer
 *       "404":
 *         description: Course, lesson, or enrollment not found
 *       "503":
 *         description: Contentful or database unavailable
 */
router.post(
  "/:courseId/lessons/:lessonId/answers",
  checkJwt,
  loadAppUser,
  async (req, res, next) => {
    try {
      const { courseId, lessonId } = req.params;
      const questionId =
        typeof req.body?.questionId === "string"
          ? req.body.questionId.trim()
          : "";
      const answerId =
        typeof req.body?.answerId === "string" ? req.body.answerId.trim() : "";

      if (!questionId || !answerId) {
        return res.status(400).json({
          error: "Bad Request",
          message: "questionId and answerId are required",
        });
      }

      const loaded = await loadLessonForEnrolledUser(
        courseId,
        lessonId,
        req.appUser,
        { include: 4 },
      );
      const accessError = respondLessonAccessError(loaded, res);
      if (accessError) {
        return accessError;
      }

      if (
        !isValidAnswerForLessonQuestion(loaded.lesson, questionId, answerId)
      ) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Invalid questionId or answerId for this lesson",
        });
      }

      await createOrGetLessonProgress(req.appUser.id, courseId, lessonId);

      const { created } = await upsertLessonQuestionAnswer(
        req.appUser.id,
        courseId,
        lessonId,
        questionId,
        answerId,
      );

      const body = await buildLessonResponse(
        req.appUser.id,
        courseId,
        lessonId,
        loaded.lesson,
      );

      return res.status(created ? 201 : 200).json(body);
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
      return handleLessonProgressDbError(error, res, next);
    }
  },
);

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
    const detail = await mapCourseDetailWithLessonProgress(
      entry,
      req.appUser.id,
    );
    res.json({
      course: attachEnrollmentToCourse(detail, enrollment),
    });
  } catch (error) {
    if (error.code === "42P01") {
      return handleLessonProgressDbError(error, res, next);
    }
    handleContentfulError(error, res, next);
  }
});

export default router;
