import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, abandonedCartReminderEmailHtml, isEmailConfigured } from "@/lib/email";
import { emailImageSrc, resolveCartLineImagePath } from "@/lib/shop/cartLineImage";
import { getSiteBaseUrl } from "@/lib/siteUrl";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import { runApiRoute } from "@/lib/api/runApiRoute";

/**
 * Sends one reminder email per cart after idle period (logged-in customers only).
 * Protect with CRON_SECRET or Vercel cron header.
 */
export async function GET(req: NextRequest) {
  return runApiRoute(async () => {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization") ?? "";
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    const hasValidBearer = !!cronSecret && auth === `Bearer ${cronSecret}`;
  
    if (!isVercelCron && !hasValidBearer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  
    // Test override: minute precision for faster QA (e.g. ABANDONED_CART_MINUTES=10).
    const minutesRaw = Number(process.env.ABANDONED_CART_MINUTES ?? "");
    const hasMinuteOverride = Number.isFinite(minutesRaw) && minutesRaw > 0;
    const hours = Math.min(168, Math.max(1, Number(process.env.ABANDONED_CART_HOURS ?? 48)));
    const idleMs = hasMinuteOverride ? minutesRaw * 60 * 1000 : hours * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - idleMs);
  
    const carts = await prisma.carts.findMany({
      where: {
        status: "ACTIVE",
        customer_id: { not: null },
        abandoned_reminder_sent_at: null,
        updated_at: { lt: cutoff },
        cart_items: { some: {} },
      },
      select: {
        id: true,
        customers: { select: { email: true } },
        cart_items: {
          take: 6,
          select: {
            quantity: true,
            products: {
              select: {
                name: true,
                slug: true,
                product_images: { select: { url: true, sort_order: true } },
                product_variants: {
                  select: {
                    is_default: true,
                    product_images: { select: { url: true, sort_order: true } },
                  },
                },
              },
            },
            product_variants: {
              select: { product_images: { select: { url: true, sort_order: true } } },
            },
          },
        },
      },
      take: 200,
    });
  
    let sent = 0;
    const siteBase = getSiteBaseUrl();
    const shopUrl = `${siteBase}/shop`;
  
    for (const c of carts) {
      const email = c.customers?.email;
      if (!email || isSyntheticPhoneSignupEmail(email)) continue;
      const lines = c.cart_items.map((ci) => {
        const name = ci.products?.name ?? "Item";
        const slug = ci.products?.slug;
        const imagePath = resolveCartLineImagePath(ci.products, ci.product_variants);
        return {
          name,
          quantity: ci.quantity,
          imageUrl: emailImageSrc(imagePath, siteBase),
          productUrl: slug ? `${siteBase}/shop/${slug}` : shopUrl,
        };
      });
      const sampleLines = lines.map((l) => `${l.name} × ${l.quantity}`);
      if (!isEmailConfigured()) {
        console.warn("[cron/abandoned-cart] SMTP not configured — skipping");
        break;
      }
      try {
        await sendEmail({
          to: email,
          subject: "You left items in your cart — i-Robox",
          html: abandonedCartReminderEmailHtml({ shopUrl, lines }),
          text: `You still have items saved in your cart at i-Robox.\n\n${sampleLines.join("\n")}\n\nContinue: ${shopUrl}`,
        });
        await prisma.carts.update({
          where: { id: c.id },
          data: { abandoned_reminder_sent_at: new Date() },
        });
        sent += 1;
      } catch (e) {
        console.error("[cron/abandoned-cart] send failed", c.id, e);
      }
    }
  
    return NextResponse.json({
      ok: true,
      scanned: carts.length,
      sent,
      mode: hasMinuteOverride ? `minutes:${minutesRaw}` : `hours:${hours}`,
      cutoff: cutoff.toISOString(),
      ranAt: new Date().toISOString(),
    });
  
  });}
