import { sanitizeCourseRole } from "./courseRole.js";
import { mapThumbnail } from "./mapImage.js";

export { mapThumbnail } from "./mapImage.js";

/**
 * @param {unknown} linkOrEntry
 */
function linkEntryId(linkOrEntry) {
  if (!linkOrEntry || typeof linkOrEntry !== "object") {
    return null;
  }
  const entry = /** @type {{ sys?: { id?: string } }} */ (linkOrEntry);
  return entry.sys?.id ?? null;
}

/**
 * @param {unknown[]} links
 */
function linkEntryIds(links) {
  if (!Array.isArray(links)) {
    return [];
  }
  return links.map(linkEntryId).filter((id) => typeof id === "string");
}

export { resolveAssetUrl } from "./mapImage.js";

/**
 * @param {import('contentful').Entry} entry
 */
export function getLessonCount(entry) {
  const lessons = entry.fields?.courseLessons;
  return Array.isArray(lessons) ? lessons.length : 0;
}

/**
 * @param {import('contentful').Entry} entry
 */
export function mapCourseSummary(entry) {
  const fields = entry.fields ?? {};
  const courseRole = sanitizeCourseRole(fields.courseRole);

  const courseSlug =
    typeof fields.courseSlug === "string" && fields.courseSlug.trim()
      ? fields.courseSlug.trim()
      : null;

  return {
    id: entry.sys.id,
    internalName: fields.internalName ?? null,
    courseSlug,
    courseName: fields.courseName ?? null,
    courseDescription: fields.courseDescription ?? null,
    courseRole,
    completionCriteria:
      typeof fields.completionCriteria === "number"
        ? fields.completionCriteria
        : null,
    lessonCount: getLessonCount(entry),
    thumbnail: mapThumbnail(fields.courseThumbnail),
    prerequisiteIds: linkEntryIds(fields.coursePrerequisite),
  };
}

/**
 * @param {unknown} lessonLink
 * @param {number} index
 */
export function mapLessonSummary(lessonLink, index) {
  const id = linkEntryId(lessonLink);
  if (!id) {
    return null;
  }

  const resolved =
    lessonLink && typeof lessonLink === "object" && "fields" in lessonLink
      ? /** @type {{ fields?: Record<string, unknown> }} */ (lessonLink)
      : null;
  const fields = resolved?.fields ?? {};

  const lessonName =
    (typeof fields.lessonName === "string" && fields.lessonName.trim()) ||
    (typeof fields.internalName === "string" && fields.internalName.trim()) ||
    (typeof fields.title === "string" && fields.title.trim()) ||
    null;

  return {
    id,
    order: index + 1,
    lessonName,
    lessonDescription: fields.lessonDescription ?? null,
  };
}

/**
 * @param {import('contentful').Entry} entry
 */
export function mapCourseLessons(entry) {
  const lessons = entry.fields?.courseLessons;
  if (!Array.isArray(lessons)) {
    return [];
  }
  return lessons
    .map((item, index) => mapLessonSummary(item, index))
    .filter((lesson) => lesson != null);
}

/**
 * @param {import('contentful').Entry} entry
 */
export function mapCourseDetail(entry) {
  const summary = mapCourseSummary(entry);
  const rawPrereqs = entry.fields?.coursePrerequisite;
  /** @type {{ id: string, courseName: string | null }[]} */
  const prerequisites = [];

  if (Array.isArray(rawPrereqs)) {
    for (const item of rawPrereqs) {
      const id = linkEntryId(item);
      if (!id) {
        continue;
      }
      const resolved =
        item && typeof item === "object" && "fields" in item
          ? /** @type {{ fields?: { courseName?: string } }} */ (item)
          : null;
      prerequisites.push({
        id,
        courseName: resolved?.fields?.courseName ?? null,
      });
    }
  }

  return {
    ...summary,
    prerequisites,
    lessons: mapCourseLessons(entry),
  };
}
