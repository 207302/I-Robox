import "server-only";

import { v2 as cloudinary } from "cloudinary";

export {
  ADMIN_IMAGE_ALLOWED_TYPES,
  ADMIN_IMAGE_MAX_BYTES,
  CLOUDINARY_ADMIN_IMAGE_FOLDERS,
  isAllowedAdminImageFolder,
} from "@/lib/cloudinary/adminImageUploadConstants";

export function configureCloudinaryAdmin() {
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export async function uploadAdminImageToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<{ secure_url: string; public_id: string }> {
  configureCloudinaryAdmin();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        format: "webp",
        transformation: [{ width: 1200, height: 1200, crop: "limit" }],
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Upload failed"));
        else resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}
