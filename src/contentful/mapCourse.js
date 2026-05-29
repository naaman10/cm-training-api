import { sanitizeCourseRole } from "./courseRole.js";

/**
 * @param {{ url?: string } | undefined} file
 */
export function resolveAssetUrl(file) {
  if (!file?.url || typeof file.url !== "string") {
    return null;
  }
  return file.url.startsWith("//") ? `https:${file.url}` : file.url;
}

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

/**
 * @param {unknown} thumbnailLink Resolved image entry or link
 */
function mapThumbnail(thumbnailLink) {
  if (!thumbnailLink || typeof thumbnailLink !== "object") {
    return null;
  }

  const entry = /** @type {Record<string, unknown>} */ (thumbnailLink);
  const fields = /** @type {Record<string, unknown>} */ (entry.fields ?? {});

  /** @type {{ fields?: { file?: { url?: string, details?: { image?: { width?: number, height?: number } } } }, title?: string } | undefined} */
  let asset = fields.file;

  if (!asset?.fields?.file && fields.image && typeof fields.image === "object") {
    const imageField = /** @type {{ fields?: { file?: typeof asset extends { fields?: { file?: infer F } } ? F : never } } } */ (
      fields.image
    );
    asset = imageField;
  }

  const file = asset?.fields?.file;
  const url = resolveAssetUrl(file);
  if (!url) {
    return null;
  }

  const imageDetails = file?.details?.image;
  return {
    url,
    title: typeof asset?.title === "string" ? asset.title : undefined,
    width: imageDetails?.width,
    height: imageDetails?.height,
  };
}

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

  return {
    id: entry.sys.id,
    internalName: fields.internalName ?? null,
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
  };
}
