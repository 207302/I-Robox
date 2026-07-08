import { NextRequest, NextResponse } from "next/server";
import { requireAdminWrite } from "@/lib/admin/rbac";
import {
  deleteMarketingEntityById,
  MARKETING_BULK_ENTITIES,
  revalidateAfterMarketingBulkDelete,
  type MarketingBulkEntity,
} from "@/lib/admin/marketingBulkDelete";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

const MAX_BULK_DELETE = 50;

function isMarketingEntity(value: string): value is MarketingBulkEntity {
  return (MARKETING_BULK_ENTITIES as string[]).includes(value);
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_bulk_delete:${req.ip ?? "unknown"}`, 1);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const entity = String(parsed.body.entity ?? "").trim();
    if (!isMarketingEntity(entity)) {
      return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    }

    const rawIds = parsed.body.ids;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }
    if (rawIds.length > MAX_BULK_DELETE) {
      return NextResponse.json(
        { error: `Delete at most ${MAX_BULK_DELETE} items at a time` },
        { status: 400 }
      );
    }

    const ids = [...new Set(rawIds.map((id) => String(id).trim()).filter((id) => isUuid(id)))];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No valid ids" }, { status: 400 });
    }

    const deleted: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const id of ids) {
      const result = await deleteMarketingEntityById(entity, id);
      if (result.ok) {
        deleted.push(id);
      } else {
        failed.push({ id: result.id, error: result.error });
      }
    }

    if (deleted.length > 0) {
      revalidateAfterMarketingBulkDelete(entity);
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
  });
}
