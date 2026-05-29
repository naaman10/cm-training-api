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
    include: 2,
    order: ["fields.courseName"],
  });
  return response.items;
}

/**
 * @param {string} id Contentful entry id
 * @returns {Promise<import('contentful').Entry>}
 */
export async function fetchCourseById(id) {
  assertContentfulConfigured();
  const client = getContentfulDeliveryClient();
  return client.getEntry(id, { include: 2 });
}
