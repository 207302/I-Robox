import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { cleanOptionalHtml, cleanOptionalText, cleanText, normalizeCode, readJsonBody } from "@/lib/validation/input";
import { parseOptionalDate } from "@/lib/admin/parseMarketingBody";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { revalidatePopups } from "@/lib/cache/revalidate";

const FREQUENCIES = ["ONCE_PER_SESSION", "ONCE_PER_DEVICE", "EVERY_VISIT"] as const;
const AUDIENCES = ["ALL", "GUESTS_ONLY", "LOGGED_IN_ONLY"] as const;
type Frequency = (typeof FREQUENCIES)[number];
type Audience = (typeof AUDIENCES)[number];

function parseFrequency(s: string): Frequency | null {
  return (FREQUENCIES as readonly string[]).includes(s) ? (s as Frequency) : null;
}
function parseAudience(s: string): Audience | null {
  return (AUDIENCES as readonly string[]).includes(s) ? (s as Audience) : null;
}

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = await prisma.marketing_popups.findMany({ orderBy: { sort_priority: "asc" } });
    return NextResponse.json(rows);
  
  });}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStrict(`admin_marketing_pop_post:${req.ip ?? "unknown"}`, 1);
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
  
    const title = cleanText(body.title, 255);
    const popupBody = cleanOptionalHtml(body.body, 4000);
    if (!title || !popupBody) return NextResponse.json({ error: "title and body required" }, { status: 400 });
  
    const frequency = parseFrequency(cleanText(body.frequency ?? "ONCE_PER_SESSION", 40)) ?? "ONCE_PER_SESSION";
    const audience = parseAudience(cleanText(body.audience ?? "ALL", 40)) ?? "ALL";
  
    const image_url = cleanOptionalText(body.image_url, 2000);
    const cta_label = cleanOptionalText(body.cta_label, 120);
    const cta_url = cleanOptionalText(body.cta_url, 2000);
    const delay_ms = body.delay_ms !== undefined ? Number(body.delay_ms) : 0;
    const auto_close_ms = body.auto_close_ms !== undefined ? Number(body.auto_close_ms) : 0;
    const sort_priority = body.sort_priority !== undefined ? Number(body.sort_priority) : 0;
    const is_active = Boolean(body.is_active);
    const active_from = parseOptionalDate(body.active_from);
    const active_until = parseOptionalDate(body.active_until);
  
    let suggested_coupon_code: string | null = null;
    if (body.suggested_coupon_code !== undefined && body.suggested_coupon_code !== null && body.suggested_coupon_code !== "") {
      const c = normalizeCode(String(body.suggested_coupon_code));
      suggested_coupon_code = c || null;
    }
  
    const created = await prisma.marketing_popups.create({
      data: {
        title,
        body: popupBody,
        image_url: image_url ?? null,
        cta_label: cta_label ?? null,
        cta_url: cta_url ?? null,
        delay_ms: Number.isFinite(delay_ms) ? Math.max(0, delay_ms) : 0,
        auto_close_ms: Number.isFinite(auto_close_ms) ? Math.max(0, auto_close_ms) : 0,
        frequency,
        audience,
        suggested_coupon_code,
        sort_priority: Number.isFinite(sort_priority) ? sort_priority : 0,
        is_active,
        active_from: active_from ?? null,
        active_until: active_until ?? null,
      },
      select: { id: true },
    });
  
    revalidatePopups();
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  
  });}
