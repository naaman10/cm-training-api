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
export function mapCloudinaryImage(value) {
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
export function mapImageFromField(fieldValue) {
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
    const mapped = mapImageFromField(entry.fields[key]);
    if (mapped) {
      return mapped;
    }
  }

  for (const value of Object.values(entry.fields)) {
    const mapped = mapImageFromField(value);
    if (mapped) {
      return mapped;
    }
  }

  return null;
}

/**
 * @param {unknown} thumbnailLink
 */
export function mapThumbnail(thumbnailLink) {
  return mapImageFromField(thumbnailLink);
}
