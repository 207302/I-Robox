import { NextRequest, NextResponse } from "next/server";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";
import { isAllowedAdminImageFolder } from "@/lib/cloudinary/adminImageUploadConstants";
import { listCloudinaryAdminImages } from "@/lib/cloudinary/listAdminCloudinaryImages";

/** List images in a Cloudinary folder for the admin picker (newest first). */
export async function GET(req: NextRequest) {
  return runAdminApiRoute(
    async () => {
      const auth = await requireAdminWrite();
      if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const folder = req.nextUrl.searchParams.get("folder")?.trim() ?? "";
      if (!folder || !isAllowedAdminImageFolder(folder)) {
        return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
      }

      const nextCursor = req.nextUrl.searchParams.get("cursor");
      const maxResults = Number(req.nextUrl.searchParams.get("limit") ?? "48");

      try {
        const result = await listCloudinaryAdminImages({
          folder,
          maxResults: Number.isFinite(maxResults) ? maxResults : 48,
          nextCursor,
        });
        return NextResponse.json({ folder, ...result });
      } catch (err: unknown) {
        console.error("[admin/media/browse]", err);
        return NextResponse.json({ error: "Could not load Cloudinary images" }, { status: 502 });
      }
    },
    { name: "GET /api/admin/media/browse", timeoutMs: 30_000 }
  );
}
