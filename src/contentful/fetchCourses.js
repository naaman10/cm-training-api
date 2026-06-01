import { getContentfulDeliveryClient, isContentfulConfigured } from "./client.js";

export class ContentfulNotConfiguredError extends Error {
  constructor() {
    super(
      "Contentful is not configured. Set CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN.",
    );
    this.name = "ContentfulNotConfiguredError";
    this.status = 503;
  }
}

export function getCourseContentType() {
  return process.env.CONTENTFUL_COURSE_CONTENT_TYPE?.trim() || "course";
}

function assertContentfulConfigured() {
  if (!isContentfulConfigured()) {
    throw new ContentfulNotConfiguredError();
  }
}

/**
 * @returns {Promise<import('contentful').Entry[]>}
 */
export async function fetchAllCourses() {
  assertContentfulConfigured();
  const client = getContentfulDeliveryClient();
  const response = await client.getEntries({
    content_type: getCourseContentType(),
    include: 3,
    order: ["fields.courseName"],
  });
  return response.items;
}

/**
 * @param {string} id Contentful entry id
 * @param {{ include?: number }} [options]
 * @returns {Promise<import('contentful').Entry>}
 */
export async function fetchCourseById(id, options = {}) {
  assertContentfulConfigured();
  const client = getContentfulDeliveryClient();
  const include = options.include ?? 3;
  return client.getEntry(id, { include });
}

/**
 * @param {string} courseSlug
 * @returns {Promise<import('contentful').Entry>}
 */
export async function fetchCourseBySlug(courseSlug) {
  assertContentfulConfigured();
  const client = getContentfulDeliveryClient();
  const slug = courseSlug?.trim();
  if (!slug) {
    const error = new Error("Course slug is required");
    error.sys = { id: "NotFound" };
    throw error;
  }

  const response = await client.getEntries({
    content_type: getCourseContentType(),
    "fields.courseSlug": slug,
    include: 3,
    limit: 1,
  });

  let entry = response.items[0];
  if (!entry) {
    const slugLower = slug.toLowerCase();
    const entries = await fetchAllCourses();
    entry = entries.find((item) => {
      const value = item.fields?.courseSlug;
      return (
        typeof value === "string" &&
        value.trim().toLowerCase() === slugLower
      );
    });
  }

  if (!entry) {
    const error = new Error("Course not found");
    error.sys = { id: "NotFound" };
    throw error;
  }

  return entry;
}
