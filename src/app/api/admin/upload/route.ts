import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getAdminSession } from "@/lib/auth/session";
import { runApiRoute } from "@/lib/api/runApiRoute";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
/** Stay under Vercel's ~4.5 MB serverless body limit so the request reaches this route. */
const MAX_SIZE_BYTES = 9 * 1024 * 1024; // 9 MB

function isAllowed(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("MANAGER") || roles.includes("STAFF");
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
  
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, WebP and GIF are allowed" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 9 MB)" }, { status: 400 });
    }
  
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
  
    // Stream the buffer directly to Cloudinary — no base64 overhead
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "irobox/products",
          resource_type: "image",
          // Quality and format optimisation happens at delivery time (no blocking eager transforms)
          format: "webp",
          transformation: [{ width: 1200, height: 1200, crop: "limit" }],
        },
        (error, result) => {
          if (error || !result) reject(error ?? new Error("Upload failed"));
          else resolve(result as { secure_url: string });
        }
      );
      stream.end(buffer);
    });
  
    return NextResponse.json({ url: result.secure_url }, { status: 201 });
  
  });}
