import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid, readJsonBody } from "@/lib/validation/input";
import { deleteProductById, destroyCloudinaryImages } from "@/lib/admin/deleteProduct";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";
import { revalidateProductCatalog, revalidateSitemap } from "@/lib/cache/revalidate";

const MAX_BULK_DELETE = 50;

function isAllowed(roles: string[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("MANAGER") || roles.includes("STAFF");
}

export async function POST(req: NextRequest) {
  return runAdminApiRoute(
    async () => {
      try {
        assertSameOrigin(req);
        await rateLimitStrict(`admin_products_bulk_delete:${req.ip ?? "unknown"}`, 1);
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "BAD_ORIGIN") {
          return NextResponse.json({ error: "Bad origin" }, { status: 403 });
        }
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }

      const session = await getAdminSession();
      if (!session || !isAllowed(session.roles)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const parsed = await readJsonBody(req);
      if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

      const rawIds = parsed.body.ids;
      if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return NextResponse.json({ error: "ids array is required" }, { status: 400 });
      }
      if (rawIds.length > MAX_BULK_DELETE) {
        return NextResponse.json(
          { error: `Delete at most ${MAX_BULK_DELETE} products at a time` },
          { status: 400 }
        );
      }

      const ids = [...new Set(rawIds.map((id) => String(id).trim()).filter((id) => isUuid(id)))];
      if (ids.length === 0) {
        return NextResponse.json({ error: "No valid product ids" }, { status: 400 });
      }

      const deleted: string[] = [];
      const failed: { id: string; error: string }[] = [];
      const deletedSlugs: string[] = [];
      const cloudinaryIds: string[] = [];

      for (const id of ids) {
        const result = await deleteProductById(id);
        if (result.ok) {
          deleted.push(id);
          deletedSlugs.push(result.slug);
          cloudinaryIds.push(...result.cloudinaryPublicIds);
        } else {
          failed.push({ id, error: result.error });
        }
      }

      if (deleted.length > 0) {
        destroyCloudinaryImages(cloudinaryIds);
        after(() => {
          try {
            for (const slug of deletedSlugs) {
              revalidateProductCatalog({ slug });
            }
            revalidateSitemap();
          } catch (err) {
            console.error("[admin products bulk-delete] revalidate failed", err);
          }
        });
      }

      return NextResponse.json(
        {
          ok: true,
          deleted,
          failed,
          deletedCount: deleted.length,
          failedCount: failed.length,
        },
        { status: 200 }
      );
    },
    { name: "POST /api/admin/products/bulk-delete" }
  );
}
