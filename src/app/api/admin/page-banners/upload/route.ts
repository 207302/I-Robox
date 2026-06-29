import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { runApiRoute } from "@/lib/api/runApiRoute";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 9 * 1024 * 1024;

function isAllowed(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("MANAGER") || roles.includes("STAFF");
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }

    const session = await getAdminSession();
    if (!session || !isAllowed(session.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

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

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "irobox/page-banners",
          resource_type: "image",
          format: "webp",
          transformation: [{ width: 2400, height: 800, crop: "limit" }],
        },
        (error, uploaded) => {
          if (error || !uploaded) reject(error ?? new Error("Upload failed"));
          else resolve({ secure_url: uploaded.secure_url });
        }
      );
      stream.end(buffer);
    });

    return NextResponse.json({ url: result.secure_url }, { status: 201 });
  });
}
