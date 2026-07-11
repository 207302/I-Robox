import "server-only";

import { v2 as cloudinary } from "cloudinary";
import { formatUnknownError } from "@/lib/observability/formatUnknownError";
import { isAllowedImageMime, resolveImageMimeType } from "@/lib/cloudinary/resolveImageMimeType";
import { ADMIN_IMAGE_MAX_BYTES, isAllowedAdminImageFolder } from "@/lib/cloudinary/adminImageUploadConstants";

export {
  ADMIN_IMAGE_ALLOWED_TYPES,
  ADMIN_IMAGE_MAX_BYTES,
  CLOUDINARY_ADMIN_IMAGE_FOLDERS,
  isAllowedAdminImageFolder,
} from "@/lib/cloudinary/adminImageUploadConstants";

function readEnv(name: string): string {
  const raw = String(process.env[name] ?? "").trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

export function configureCloudinaryAdmin() {
  cloudinary.config({
    cloud_name: readEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"),
    api_key: readEnv("CLOUDINARY_API_KEY"),
    api_secret: readEnv("CLOUDINARY_API_SECRET"),
  });
}

export function isCloudinaryAdminConfigured(): boolean {
  return Boolean(
    readEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME") &&
      readEnv("CLOUDINARY_API_KEY") &&
      readEnv("CLOUDINARY_API_SECRET")
  );
}

export function getCloudinaryCloudName(): string {
  return readEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
}

export function getMissingCloudinaryEnvKeys(): string[] {
  const keys = [
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ] as const;
  return keys.filter((key) => !readEnv(key));
}

export async function pingCloudinaryAdmin(): Promise<{ ok: boolean; error?: string }> {
  if (!isCloudinaryAdminConfigured()) {
    return { ok: false, error: "not_configured" };
  }
  try {
    configureCloudinaryAdmin();
    const result = await cloudinary.api.ping();
    if (String(result?.status ?? "").toLowerCase() === "ok") return { ok: true };
    return { ok: false, error: "unexpected_ping_response" };
  } catch (err: unknown) {
    return { ok: false, error: formatUnknownError(err).message };
  }
}

export async function uploadAdminImageToCloudinary(
  buffer: Buffer,
  folder: string,
  mime = "image/jpeg"
): Promise<{ secure_url: string; public_id: string }> {
  configureCloudinaryAdmin();

  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
    format: "webp",
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  });

  if (!result?.secure_url) {
    throw new Error("Cloudinary upload returned no URL");
  }

  return { secure_url: result.secure_url, public_id: result.public_id };
}

export type AdminImageUploadResult =
  | { ok: true; url: string; public_id: string; folder: string }
  | { ok: false; status: number; error: string };

/** Shared handler for /api/admin/upload and /api/admin/media/upload. */
export async function processAdminImageUploadFormData(
  formData: FormData,
  defaultFolder = "irobox/products"
): Promise<AdminImageUploadResult> {
  if (!isCloudinaryAdminConfigured()) {
    return {
      ok: false,
      status: 503,
      error: `Cloudinary not configured. Missing: ${getMissingCloudinaryEnvKeys().join(", ")}`,
    };
  }

  const file = formData.get("file") as File | null;
  const folder = String(formData.get("folder") ?? defaultFolder).trim();

  if (!file) return { ok: false, status: 400, error: "No file provided" };
  if (!isAllowedAdminImageFolder(folder)) {
    return { ok: false, status: 400, error: "Invalid folder" };
  }

  const mime = resolveImageMimeType(file.name, file.type);
  if (!isAllowedImageMime(mime)) {
    return {
      ok: false,
      status: 400,
      error: `Unsupported image type (${file.type || "unknown"}). Use JPEG, PNG, WebP, or GIF.`,
    };
  }
  if (file.size > ADMIN_IMAGE_MAX_BYTES) {
    return { ok: false, status: 400, error: "File too large (max 9 MB)" };
  }
  if (file.size === 0) {
    return { ok: false, status: 400, error: "File is empty" };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  try {
    const result = await uploadAdminImageToCloudinary(buffer, folder, mime);
    return {
      ok: true,
      url: result.secure_url,
      public_id: result.public_id,
      folder,
    };
  } catch (err: unknown) {
    const formatted = formatUnknownError(err);
    console.error("[admin/image-upload]", formatted);
    return {
      ok: false,
      status: 502,
      error:
        formatted.message && formatted.message !== "unknown error"
          ? formatted.message
          : "Cloudinary upload failed",
    };
  }
}
