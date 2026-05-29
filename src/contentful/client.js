import { createClient } from "contentful";

/** @type {import('contentful').ContentfulClientApi | undefined} */
let deliveryClient;
/** @type {import('contentful').ContentfulClientApi | undefined} */
let previewClient;

/**
 * @returns {{
 *   spaceId: string | undefined;
 *   accessToken: string | undefined;
 *   environment: string;
 *   previewAccessToken: string | undefined;
 * }}
 */
export function getContentfulConfig() {
  return {
    spaceId: process.env.CONTENTFUL_SPACE_ID?.trim(),
    accessToken: process.env.CONTENTFUL_ACCESS_TOKEN?.trim(),
    environment: process.env.CONTENTFUL_ENVIRONMENT?.trim() || "master",
    previewAccessToken: process.env.CONTENTFUL_PREVIEW_ACCESS_TOKEN?.trim(),
  };
}

export function isContentfulConfigured() {
  const { spaceId, accessToken } = getContentfulConfig();
  return Boolean(spaceId && accessToken);
}

export function isContentfulPreviewConfigured() {
  const { spaceId, previewAccessToken } = getContentfulConfig();
  return Boolean(spaceId && previewAccessToken);
}

/**
 * Content Delivery API client (published content).
 * @throws {Error} When CONTENTFUL_SPACE_ID or CONTENTFUL_ACCESS_TOKEN is missing
 */
export function getContentfulDeliveryClient() {
  if (deliveryClient) {
    return deliveryClient;
  }

  const { spaceId, accessToken, environment } = getContentfulConfig();
  if (!spaceId || !accessToken) {
    throw new Error(
      "Contentful is not configured. Set CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN.",
    );
  }

  deliveryClient = createClient({
    space: spaceId,
    accessToken,
    environment,
  });
  return deliveryClient;
}

/**
 * Content Preview API client (draft content). Requires CONTENTFUL_PREVIEW_ACCESS_TOKEN.
 * @throws {Error} When preview credentials are missing
 */
export function getContentfulPreviewClient() {
  if (previewClient) {
    return previewClient;
  }

  const { spaceId, environment, previewAccessToken } = getContentfulConfig();
  if (!spaceId || !previewAccessToken) {
    throw new Error(
      "Contentful preview is not configured. Set CONTENTFUL_SPACE_ID and CONTENTFUL_PREVIEW_ACCESS_TOKEN.",
    );
  }

  previewClient = createClient({
    space: spaceId,
    accessToken: previewAccessToken,
    environment,
    host: "preview.contentful.com",
  });
  return previewClient;
}
