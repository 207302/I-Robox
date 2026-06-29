export const CLOUDINARY_ADMIN_IMAGE_FOLDERS = [
  { id: "irobox/products", label: "Products" },
  { id: "irobox/media", label: "General media" },
  { id: "irobox/homepage-hero", label: "Homepage hero" },
  { id: "irobox/homepage-highlights", label: "Homepage highlights" },
  { id: "irobox/homepage-category-tiles", label: "Category tiles" },
  { id: "irobox/homepage-brand-rail", label: "Brand rail" },
  { id: "irobox/page-banners", label: "Brand & category page banners" },
  { id: "irobox/marketing-popups", label: "Marketing popups" },
] as const;

export type CloudinaryFolderId = (typeof CLOUDINARY_ADMIN_IMAGE_FOLDERS)[number]["id"];

export const ADMIN_IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Stay under typical serverless body limits so the request reaches the route. */
export const ADMIN_IMAGE_MAX_BYTES = 9 * 1024 * 1024;

const ALLOWED_FOLDER_IDS = new Set<string>(
  CLOUDINARY_ADMIN_IMAGE_FOLDERS.map((f) => f.id)
);

export function isAllowedAdminImageFolder(folder: string): boolean {
  return ALLOWED_FOLDER_IDS.has(folder);
}
