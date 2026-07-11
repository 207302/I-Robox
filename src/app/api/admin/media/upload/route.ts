import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { processAdminImageUploadFormData } from "@/lib/cloudinary/adminImageUpload";

function isAllowedAdminRole(roles: string[]) {
  return roles.some((r) => ["SUPER_ADMIN", "MANAGER", "STAFF"].includes(r));
}

/** Alias of /api/admin/upload — kept for bulk media panel and backwards compatibility. */
export async function POST(req: NextRequest) {
  return runApiRoute(
    async () => {
      const session = await getAdminSession();
      if (!session || !isAllowedAdminRole(session.roles ?? [])) {
        return NextResponse.json({ error: "Forbidden — sign in as admin" }, { status: 403 });
      }

      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return NextResponse.json(
          { error: "Could not read upload (file may exceed server limit — try under 5 MB)" },
          { status: 400 }
        );
      }

      const result = await processAdminImageUploadFormData(formData);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      return NextResponse.json(
        { url: result.url, public_id: result.public_id, folder: result.folder },
        { status: 201 }
      );
    },
    { name: "POST /api/admin/media/upload", timeoutMs: 60_000 }
  );
}
