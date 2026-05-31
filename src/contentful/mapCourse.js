import { sanitizeCourseRole } from "./courseRole.js";

/**
 * @param {{ url?: string, details?: { image?: { width?: number, height?: number } } } | undefined} file
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
 * @param {unknown} value
 */
function isAsset(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const sys = /** @type {{ sys?: { type?: string, linkType?: string } }} */ (value).sys;
  return sys?.type === "Asset" || sys?.linkType === "Asset";
}

/**
 * @param {unknown} asset
 * @returns {{ url: string, title?: string, width?: number, height?: number } | null}
 */
function mapAsset(asset) {
  if (!isAsset(asset)) {
    return null;
  }
  const fields = /** @type {{ file?: { url?: string, details?: { image?: { width?: number, height?: number } } }, title?: string } } */ (
    asset
  ).fields;
  const file = fields?.file;
  const url = resolveAssetUrl(file);
  if (!url) {
    return null;
  }
  const imageDetails = file?.details?.image;
  return {
    url,
    title: typeof fields?.title === "string" ? fields.title : undefined,
    width: imageDetails?.width,
    height: imageDetails?.height,
  };
}

/**
 * Contentful Cloudinary app stores images as JSON (object or array), not Assets.
 * @param {unknown} value
 */
function mapCloudinaryImage(value) {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== "object") {
    return null;
  }
  const cloudinary = /** @type {{ secure_url?: string, url?: string, width?: number, height?: number, public_id?: string } } */ (
    item
  );
  const url =
    typeof cloudinary.secure_url === "string"
      ? cloudinary.secure_url
      : typeof cloudinary.url === "string"
        ? cloudinary.url
        : null;
  if (!url) {
    return null;
  }
  return {
    url,
    title:
      typeof cloudinary.public_id === "string" ? cloudinary.public_id : undefined,
    width: typeof cloudinary.width === "number" ? cloudinary.width : undefined,
    height: typeof cloudinary.height === "number" ? cloudinary.height : undefined,
  };
}

/**
 * @param {unknown} fieldValue Asset, Cloudinary JSON, or entry field containing image data
 * @returns {{ url: string, title?: string, width?: number, height?: number } | null}
 */
function mapThumbnailFromField(fieldValue) {
  if (!fieldValue || typeof fieldValue !== "object") {
    return null;
  }

  if (isAsset(fieldValue)) {
    return mapAsset(fieldValue);
  }

  const cloudinary = mapCloudinaryImage(fieldValue);
  if (cloudinary) {
    return cloudinary;
  }

  const entry = /** @type {{ fields?: Record<string, unknown> } } */ (fieldValue);
  if (!entry.fields) {
    return null;
  }

  const preferredKeys = ["image", "file", "asset", "media", "thumbnail"];
  for (const key of preferredKeys) {
    const mapped = mapThumbnailFromField(entry.fields[key]);
    if (mapped) {
      return mapped;
    }
  }

  for (const value of Object.values(entry.fields)) {
    const mapped = mapThumbnailFromField(value);
    if (mapped) {
      return mapped;
    }
  }

  return null;
}

/**
 * courseThumbnail links to an `image` content type entry (or a resolved asset).
 * @param {unknown} thumbnailLink
 */
export function mapThumbnail(thumbnailLink) {
  return mapThumbnailFromField(thumbnailLink);
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
 * @param {unknown} lessonLink
 * @param {number} index
 */
function mapLessonSummary(lessonLink, index) {
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
