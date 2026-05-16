import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalText, cleanText, isUuid, normalizeCode, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";

const FREQUENCIES = ["ONCE_PER_SESSION", "ONCE_PER_DEVICE", "EVERY_VISIT"] as const;
type Frequency = (typeof FREQUENCIES)[number];
const AUDIENCES = ["ALL", "GUESTS_ONLY", "LOGGED_IN_ONLY"] as const;
type Audience = (typeof AUDIENCES)[number];

function parseFrequency(s: string): Frequency | null {
  return (FREQUENCIES as readonly string[]).includes(s) ? (s as Frequency) : null;
}
function parseAudience(s: string): Audience | null {
  return (AUDIENCES as readonly string[]).includes(s) ? (s as Audience) : null;
}

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function cloudinaryPublicIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const marker = "/image/upload/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    let tail = u.pathname.slice(idx + marker.length);
    tail = tail.replace(/^v\d+\//, "");
    tail = tail.replace(/\.[a-zA-Z0-9]+$/, "");
    return tail || null;
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_mpop_patch:${req.ip ?? "unknown"}`, 1);
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
  
    if (body.title !== undefined) {
      const t = cleanText(body.title, 255);
      if (!t) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      data.title = t;
    }
    if (body.body !== undefined) {
      const b = cleanText(body.body, 4000);
      if (!b) return NextResponse.json({ error: "body cannot be empty" }, { status: 400 });
      data.body = b;
    }
    if (body.image_url !== undefined) data.image_url = cleanOptionalText(body.image_url, 2000) ?? null;
    if (body.cta_label !== undefined) data.cta_label = cleanOptionalText(body.cta_label, 120) ?? null;
    if (body.cta_url !== undefined) data.cta_url = cleanOptionalText(body.cta_url, 2000) ?? null;
    if (body.delay_ms !== undefined) {
      const n = Number(body.delay_ms);
      if (Number.isFinite(n)) data.delay_ms = Math.max(0, n);
    }
    if (body.auto_close_ms !== undefined) {
      const n = Number(body.auto_close_ms);
      if (Number.isFinite(n)) data.auto_close_ms = Math.max(0, n);
    }
    if (body.frequency !== undefined) {
      const f = parseFrequency(cleanText(body.frequency, 40));
      if (!f) return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
      data.frequency = f;
    }
    if (body.audience !== undefined) {
      const a = parseAudience(cleanText(body.audience, 40));
      if (!a) return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
      data.audience = a;
    }
    if (body.suggested_coupon_code !== undefined) {
      if (body.suggested_coupon_code === null || body.suggested_coupon_code === "") {
        data.suggested_coupon_code = null;
      } else {
        const c = normalizeCode(String(body.suggested_coupon_code));
        data.suggested_coupon_code = c || null;
      }
    }
    if (body.sort_priority !== undefined) {
      const n = Number(body.sort_priority);
      if (Number.isFinite(n)) data.sort_priority = n;
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
  
    await prisma.marketing_popups.update({ where: { id }, data });
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_mpop_del:${req.ip ?? "unknown"}`, 1);
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
  
    const row = await prisma.marketing_popups.findUnique({
      where: { id },
      select: { image_url: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
    await prisma.marketing_popups.delete({ where: { id } });
    const derivedPublicId = cloudinaryPublicIdFromUrl(row.image_url);
    if (derivedPublicId?.startsWith("irobox/marketing-popups/")) {
      await cloudinary.uploader.destroy(derivedPublicId).catch(() => null);
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  
  });}
