import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security/origin";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { requireSuperAdmin } from "@/lib/admin/rbac";
import {
  ADMIN_IMAGE_ALLOWED_TYPES,
  ADMIN_IMAGE_MAX_BYTES,
  isAllowedAdminImageFolder,
  uploadAdminImageToCloudinary,
} from "@/lib/cloudinary/adminImageUpload";

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
    } catch {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }

    const auth = await requireSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: "Only SUPER_ADMIN can bulk-upload media" }, { status: 403 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const folder = String(formData.get("folder") ?? "irobox/products").trim();

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!isAllowedAdminImageFolder(folder)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }
    if (!ADMIN_IMAGE_ALLOWED_TYPES.includes(file.type as (typeof ADMIN_IMAGE_ALLOWED_TYPES)[number])) {
      return NextResponse.json({ error: "Only JPEG, PNG, WebP and GIF are allowed" }, { status: 400 });
    }
    if (file.size > ADMIN_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 9 MB)" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    try {
      const result = await uploadAdminImageToCloudinary(buffer, folder);
      return NextResponse.json(
        { url: result.secure_url, public_id: result.public_id, folder },
        { status: 201 }
      );
    } catch (err: unknown) {
      console.error("[admin/media/upload]", err);
      return NextResponse.json({ error: "Cloudinary upload failed" }, { status: 502 });
    }
  });
}
