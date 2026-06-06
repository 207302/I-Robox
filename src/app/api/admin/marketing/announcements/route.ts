import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";
import { revalidateAnnouncements } from "@/lib/cache/revalidate";

const PLACEMENTS = ["UTILITY", "MARQUEE"] as const;
type Placement = (typeof PLACEMENTS)[number];

function parsePlacement(s: string): Placement | null {
  return (PLACEMENTS as readonly string[]).includes(s) ? (s as Placement) : null;
}

export async function GET() {
  return runAdminApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = await prisma.announcement_entries.findMany({
      orderBy: [{ placement: "asc" }, { sort_order: "asc" }],
    });
    return NextResponse.json(rows);
  }, { name: "GET /api/admin/marketing/announcements" });
}

export async function POST(req: NextRequest) {
  return runAdminApiRoute(
    async () => {
      try {
        assertSameOrigin(req);
        await rateLimitStrict(`admin_marketing_ann_post:${req.ip ?? "unknown"}`, 1);
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
      const body = parsed.body;

      const placement = parsePlacement(cleanText(body.placement, 40));
      if (!placement) {
        return NextResponse.json({ error: "Invalid placement" }, { status: 400 });
      }

      const annBody = cleanText(body.body, 2000);
      if (!annBody) return NextResponse.json({ error: "body required" }, { status: 400 });
      const link_url = cleanOptionalText(body.link_url, 2000);
      const link_label = cleanOptionalText(body.link_label, 120);
      const is_active = Boolean(body.is_active);
      const active_from = parseOptionalDate(body.active_from);
      const active_until = parseOptionalDate(body.active_until);

      let sort_order =
        body.sort_order !== undefined && body.sort_order !== null && body.sort_order !== ""
          ? Number(body.sort_order)
          : NaN;
      if (!Number.isFinite(sort_order)) {
        const maxRow = await prisma.announcement_entries.aggregate({
          where: { placement },
          _max: { sort_order: true },
        });
        sort_order = (maxRow._max.sort_order ?? -1) + 1;
      }

      const created = await prisma.announcement_entries.create({
        data: {
          placement,
          body: annBody,
          link_url: link_url ?? null,
          link_label: link_label ?? null,
          sort_order,
          is_active,
          active_from: active_from ?? null,
          active_until: active_until ?? null,
        },
        select: { id: true },
      });

      after(() => {
        try {
          revalidateAnnouncements();
        } catch (err) {
          console.error("[announcements POST] revalidate failed", err);
        }
      });

      return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
    },
    { name: "POST /api/admin/marketing/announcements" }
  );
}
