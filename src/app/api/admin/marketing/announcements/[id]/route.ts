import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, isUuid, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";

const PLACEMENTS = ["UTILITY", "MARQUEE"] as const;
type Placement = (typeof PLACEMENTS)[number];

function parsePlacement(s: string): Placement | null {
  return (PLACEMENTS as readonly string[]).includes(s) ? (s as Placement) : null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_ann_patch:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const body = parsed.body;
  
    const data: Record<string, unknown> = {};
  
    if (body.placement !== undefined) {
      const p = parsePlacement(cleanText(body.placement, 40));
      if (!p) return NextResponse.json({ error: "Invalid placement" }, { status: 400 });
      data.placement = p;
    }
    if (body.body !== undefined) {
      const b = cleanText(body.body, 2000);
      if (!b) return NextResponse.json({ error: "body cannot be empty" }, { status: 400 });
      data.body = b;
    }
    if (body.link_url !== undefined) data.link_url = cleanOptionalText(body.link_url, 2000) ?? null;
    if (body.link_label !== undefined) data.link_label = cleanOptionalText(body.link_label, 120) ?? null;
    if (body.sort_order !== undefined) {
      const n = Number(body.sort_order);
      if (Number.isFinite(n)) data.sort_order = n;
    }
    if (typeof body.is_active === "boolean") data.is_active = body.is_active;
    if (body.active_from !== undefined) {
      const d = parseOptionalDate(body.active_from);
      if (d === undefined && body.active_from !== null && body.active_from !== "") {
        return NextResponse.json({ error: "Invalid active_from" }, { status: 400 });
      }
      data.active_from = d ?? null;
    }
    if (body.active_until !== undefined) {
      const d = parseOptionalDate(body.active_until);
      if (d === undefined && body.active_until !== null && body.active_until !== "") {
        return NextResponse.json({ error: "Invalid active_until" }, { status: 400 });
      }
      data.active_until = d ?? null;
    }
  
    await prisma.announcement_entries.update({ where: { id }, data });
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_ann_del:${req.ip ?? "unknown"}`, 1);
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    await prisma.announcement_entries.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}
