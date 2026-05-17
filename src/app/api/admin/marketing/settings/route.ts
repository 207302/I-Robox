import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeSiteMarketingSettingsFindUnique } from "@/lib/db/safeReads";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { prismaErrorMessage } from "@/lib/prismaErrors";
import {
  cleanOptionalHexColor,
  cleanOptionalText,
  cleanText,
  normalizeCode,
  readJsonBody,
} from "@/lib/validation/input";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdminWrite();
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const row = await safeSiteMarketingSettingsFindUnique({
      where: { id: SITE_MARKETING_SETTINGS_ID },
    });
    return NextResponse.json(row ?? { id: SITE_MARKETING_SETTINGS_ID, first_visit_coupon_code: null });
  
  });}

export async function PATCH(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimit(`admin_marketing_settings:${req.ip ?? "unknown"}`, 1);
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
    const body = parsed.body as Record<string, unknown>;
  
    const data: Prisma.site_marketing_settingsUpdateInput = {};
  
    if (body.first_visit_coupon_code !== undefined) {
      if (body.first_visit_coupon_code === null || body.first_visit_coupon_code === "") {
        data.first_visit_coupon_code = null;
      } else {
        const c = normalizeCode(String(body.first_visit_coupon_code));
        data.first_visit_coupon_code = c || null;
      }
    }
    if (body.free_shipping_threshold_inr !== undefined) {
      if (body.free_shipping_threshold_inr === null || body.free_shipping_threshold_inr === "") {
        data.free_shipping_threshold_inr = null;
      } else {
        const n = Number(body.free_shipping_threshold_inr);
        if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
          return NextResponse.json({ error: "Invalid free_shipping_threshold_inr" }, { status: 400 });
        }
        data.free_shipping_threshold_inr = new Prisma.Decimal(
          (Math.round(n * 100) / 100).toFixed(2)
        );
      }
    }
    if (body.hero_overlay_eyebrow !== undefined) {
      data.hero_overlay_eyebrow = cleanOptionalText(body.hero_overlay_eyebrow, 120);
    }
    if (body.hero_overlay_heading !== undefined) {
      data.hero_overlay_heading = cleanOptionalText(body.hero_overlay_heading, 255);
    }
    if (body.hero_overlay_subheading !== undefined) {
      data.hero_overlay_subheading =
        body.hero_overlay_subheading === null || body.hero_overlay_subheading === ""
          ? null
          : cleanText(body.hero_overlay_subheading, 5000);
    }
    if (body.hero_overlay_cta_label !== undefined) {
      data.hero_overlay_cta_label = cleanOptionalText(body.hero_overlay_cta_label, 120);
    }
    if (body.hero_overlay_cta_href !== undefined) {
      data.hero_overlay_cta_href = cleanOptionalText(body.hero_overlay_cta_href, 500);
    }
    if (body.hero_overlay_eyebrow_color !== undefined) {
      data.hero_overlay_eyebrow_color = cleanOptionalHexColor(body.hero_overlay_eyebrow_color);
    }
    if (body.hero_overlay_heading_color !== undefined) {
      data.hero_overlay_heading_color = cleanOptionalHexColor(body.hero_overlay_heading_color);
    }
    if (body.hero_overlay_subheading_color !== undefined) {
      data.hero_overlay_subheading_color = cleanOptionalHexColor(body.hero_overlay_subheading_color);
    }
    if (body.hero_overlay_cta_label_color !== undefined) {
      data.hero_overlay_cta_label_color = cleanOptionalHexColor(body.hero_overlay_cta_label_color);
    }
  
    if (body.highlights_section_eyebrow !== undefined) {
      data.highlights_section_eyebrow = cleanOptionalText(body.highlights_section_eyebrow, 120);
    }
    if (body.highlights_section_heading !== undefined) {
      data.highlights_section_heading = cleanOptionalText(body.highlights_section_heading, 255);
    }
    if (body.privacy_page_title !== undefined) data.privacy_page_title = cleanOptionalText(body.privacy_page_title, 255);
    if (body.privacy_page_subtitle !== undefined) data.privacy_page_subtitle = cleanOptionalText(body.privacy_page_subtitle, 500);
    if (body.privacy_page_content !== undefined) {
      data.privacy_page_content =
        body.privacy_page_content === null || body.privacy_page_content === ""
          ? null
          : cleanText(body.privacy_page_content, 50_000);
    }
    if (body.terms_page_title !== undefined) data.terms_page_title = cleanOptionalText(body.terms_page_title, 255);
    if (body.terms_page_subtitle !== undefined) data.terms_page_subtitle = cleanOptionalText(body.terms_page_subtitle, 500);
    if (body.terms_page_content !== undefined) {
      data.terms_page_content =
        body.terms_page_content === null || body.terms_page_content === ""
          ? null
          : cleanText(body.terms_page_content, 50_000);
    }
    if (body.returns_page_title !== undefined) data.returns_page_title = cleanOptionalText(body.returns_page_title, 255);
    if (body.returns_page_subtitle !== undefined) data.returns_page_subtitle = cleanOptionalText(body.returns_page_subtitle, 500);
    if (body.returns_page_content !== undefined) {
      data.returns_page_content =
        body.returns_page_content === null || body.returns_page_content === ""
          ? null
          : cleanText(body.returns_page_content, 50_000);
    }
    if (body.faq_page_title !== undefined) data.faq_page_title = cleanOptionalText(body.faq_page_title, 255);
    if (body.faq_page_subtitle !== undefined) data.faq_page_subtitle = cleanOptionalText(body.faq_page_subtitle, 500);
    if (body.faq_page_content !== undefined) {
      data.faq_page_content =
        body.faq_page_content === null || body.faq_page_content === ""
          ? null
          : cleanText(body.faq_page_content, 50_000);
    }
    if (body.contact_page_title !== undefined) data.contact_page_title = cleanOptionalText(body.contact_page_title, 255);
    if (body.contact_page_subtitle !== undefined) data.contact_page_subtitle = cleanOptionalText(body.contact_page_subtitle, 500);
    if (body.contact_page_content !== undefined) {
      data.contact_page_content =
        body.contact_page_content === null || body.contact_page_content === ""
          ? null
          : cleanText(body.contact_page_content, 50_000);
    }
  
    if (body.help_support_title !== undefined) {
      data.help_support_title = cleanOptionalText(body.help_support_title, 120);
    }
    if (body.contact_address !== undefined) {
      if (body.contact_address === null || body.contact_address === "") {
        data.contact_address = null;
      } else {
        const t = cleanText(body.contact_address, 5000);
        data.contact_address = t || null;
      }
    }
    if (body.contact_phone !== undefined) {
      data.contact_phone = cleanOptionalText(body.contact_phone, 80);
    }
    if (body.contact_email !== undefined) {
      data.contact_email = cleanOptionalText(body.contact_email, 200);
    }
    if (body.social_facebook_url !== undefined) {
      data.social_facebook_url = cleanOptionalText(body.social_facebook_url, 500);
    }
    if (body.social_twitter_url !== undefined) {
      data.social_twitter_url = cleanOptionalText(body.social_twitter_url, 500);
    }
    if (body.social_instagram_url !== undefined) {
      data.social_instagram_url = cleanOptionalText(body.social_instagram_url, 500);
    }
    if (body.social_linkedin_url !== undefined) {
      data.social_linkedin_url = cleanOptionalText(body.social_linkedin_url, 500);
    }
    if (body.utility_bar_bg_color !== undefined) {
      data.utility_bar_bg_color = cleanOptionalHexColor(body.utility_bar_bg_color);
    }
    if (body.marquee_bar_bg_color !== undefined) {
      data.marquee_bar_bg_color = cleanOptionalHexColor(body.marquee_bar_bg_color);
    }
    if (body.footer_bg_color !== undefined) {
      data.footer_bg_color = cleanOptionalHexColor(body.footer_bg_color);
    }
    if (body.footer_text_color !== undefined) {
      data.footer_text_color = cleanOptionalHexColor(body.footer_text_color);
    }
    if (body.footer_link_color !== undefined) {
      data.footer_link_color = cleanOptionalHexColor(body.footer_link_color);
    }
  
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No recognized fields to update" }, { status: 400 });
    }
  
    const baseCreate: Prisma.site_marketing_settingsCreateInput = {
      id: SITE_MARKETING_SETTINGS_ID,
      first_visit_coupon_code: null,
      free_shipping_threshold_inr: null,
      hero_overlay_eyebrow: null,
      hero_overlay_heading: null,
      hero_overlay_subheading: null,
      hero_overlay_cta_label: null,
      hero_overlay_cta_href: null,
      hero_overlay_eyebrow_color: null,
      hero_overlay_heading_color: null,
      hero_overlay_subheading_color: null,
      hero_overlay_cta_label_color: null,
      highlights_section_eyebrow: null,
      highlights_section_heading: null,
      privacy_page_title: null,
      privacy_page_subtitle: null,
      privacy_page_content: null,
      terms_page_title: null,
      terms_page_subtitle: null,
      terms_page_content: null,
      returns_page_title: null,
      returns_page_subtitle: null,
      returns_page_content: null,
      faq_page_title: null,
      faq_page_subtitle: null,
      faq_page_content: null,
      contact_page_title: null,
      contact_page_subtitle: null,
      contact_page_content: null,
      help_support_title: null,
      contact_address: null,
      contact_phone: null,
      contact_email: null,
      social_facebook_url: null,
      social_twitter_url: null,
      social_instagram_url: null,
      social_linkedin_url: null,
      utility_bar_bg_color: null,
      marquee_bar_bg_color: null,
      footer_bg_color: null,
      footer_text_color: null,
      footer_link_color: null,
    };
  
    try {
      const updated = await prisma.site_marketing_settings.upsert({
        where: { id: SITE_MARKETING_SETTINGS_ID },
        create: { ...baseCreate, ...data },
        update: data,
      });
      return NextResponse.json(updated, { status: 200 });
    } catch (error: unknown) {
      console.error("[admin/marketing/settings] PATCH failed:", error);
      const message = prismaErrorMessage(error);
      return NextResponse.json(
        { error: message ?? "Failed to save settings" },
        { status: message ? 503 : 500 }
      );
    }
  
  });}
