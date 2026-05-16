import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = await prisma.homepage_hero_slides.findMany({ orderBy: { sort_order: "asc" } });
    return NextResponse.json(rows);
  
  });}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_hero_post:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const image_url = cleanText(body.image_url, 2000);
    const title = cleanOptionalText(body.title, 255);
    const link_url = cleanOptionalText(body.link_url, 2000);
    const sort_order = body.sort_order !== undefined ? Number(body.sort_order) : 0;
    const is_active = Boolean(body.is_active);
    const active_from = parseOptionalDate(body.active_from);
    const active_until = parseOptionalDate(body.active_until);
    if (
      active_from === undefined &&
      body.active_from !== undefined &&
      body.active_from !== null &&
      body.active_from !== ""
    ) {
      return NextResponse.json({ error: "Invalid active_from" }, { status: 400 });
    }
    if (
      active_until === undefined &&
      body.active_until !== undefined &&
      body.active_until !== null &&
      body.active_until !== ""
    ) {
      return NextResponse.json({ error: "Invalid active_until" }, { status: 400 });
    }
  
    if (!image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 });
  
    const created = await prisma.homepage_hero_slides.create({
      data: {
        image_url,
        title: title ?? null,
        link_url: link_url ?? null,
        sort_order: Number.isFinite(sort_order) ? sort_order : 0,
        is_active,
        active_from: active_from ?? null,
        active_until: active_until ?? null,
      },
      select: { id: true },
    });
  
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  
  });}
