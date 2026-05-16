import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaDB";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { sendEmail, orderPendingCustomerEmailHtml, orderPendingCustomerEmailText } from "@/lib/email";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rateLimit";
import { createOrderAccessToken } from "@/lib/security/orderAccess";
import { validateCommonEmailProvider } from "@/lib/validateEmai";
import { getSiteBaseUrl } from "@/lib/siteUrl";
import { generatePasswordSetupSecret, PASSWORD_SETUP_TTL_MS } from "@/lib/auth/passwordSetupToken";
import bcrypt from "bcrypt";
import {
  cleanOptionalText,
  cleanText,
  hasSuspiciousInput,
  normalizeEmail,
  normalizePhone,
  readJsonBody,
  isUuid,
} from "@/lib/validation/input";
import { flashSalePriceMap, unitPriceWithFlashSale } from "@/lib/pricing/flashSale";
import {
  categoryScopeError,
  computeCouponDiscount,
  couponTimingError,
  couponUsageErrors,
  fetchCouponForCart,
} from "@/lib/coupons/cartCoupon";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { orderShippingInrFromLines } from "@/lib/checkout/orderShipping";
import { getFreeShippingThresholdInr } from "@/lib/marketing/freeShipping";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";

type CheckoutItem = {
  productId: string;
  quantity: number;
};

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await rateLimit(`checkout:${req.ip ?? "unknown"}`, 1);
  } catch (e: any) {
    if (e?.message === "BAD_ORIGIN") {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getSession();
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const body = parsed.body;

  const items = (Array.isArray(body.items) ? body.items : []) as CheckoutItem[];
  const address = (body.address ?? {}) as Record<string, unknown>;
  const isGift = Boolean(body.isGift);
  const giftMessage = cleanOptionalText(body.giftMessage, 500);
  const couponCode = cleanText(body.couponCode, 80);

  if (items.length === 0) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

  const full_name = cleanText(address.full_name, 150);
  const phone = normalizePhone(address.phone);
  const email = normalizeEmail(address.email);
  const line1 = cleanText(address.line1, 255);
  const city = cleanText(address.city, 120);
  const state = cleanText(address.state, 120);
  const postal_code = cleanText(address.postal_code, 20);
  const country = cleanText(address.country ?? "India", 80);

  if (!full_name || !phone || !email || !line1 || !city || !state || !postal_code || !country) {
    return NextResponse.json({ error: "Address is incomplete" }, { status: 400 });
  }
  if (!validateCommonEmailProvider(email)) {
    return NextResponse.json(
      { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
      { status: 400 }
    );
  }

  const guestCheckoutRequested = body.guestCheckout === true || body.guestCheckout === "true";
  const sessionEmailNorm = session?.email ? normalizeEmail(session.email) : "";
  const emailMismatch =
    Boolean(session?.sub) && sessionEmailNorm.length > 0 && sessionEmailNorm !== email;
  const guestCheckout = guestCheckoutRequested || emailMismatch;

  if (
    [full_name, phone, email, line1, city, state, postal_code, country, couponCode]
      .filter(Boolean)
      .some((v) => hasSuspiciousInput(v))
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const productIds = items.map((i) => i.productId);
  const dbProducts = await prisma.products.findMany({
    where: { id: { in: productIds }, is_active: true },
    select: {
      id: true,
      name: true,
      sku: true,
      base_price: true,
      discounted_price: true,
      shipping_per_unit: true,
      max_order_quantity: true,
      category_id: true,
    },
  });
  const productMap = new Map(dbProducts.map((p) => [p.id, p]));

  for (const item of items) {
    if (!isUuid(String(item.productId ?? ""))) {
      return NextResponse.json({ error: "One or more items are invalid" }, { status: 400 });
    }
    if (!productMap.has(item.productId)) {
      return NextResponse.json({ error: "One or more items are invalid" }, { status: 400 });
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    const p = productMap.get(item.productId)!;
    const maxOrderQty = Math.max(1, Number(p.max_order_quantity ?? 99));
    if (item.quantity > maxOrderQty) {
      return NextResponse.json({ error: `${p.name} allows max ${maxOrderQty} per order` }, { status: 400 });
    }
  }

  let checkoutUserId: string | null = null;
  let checkoutEmail = email;
  let checkoutLinkedAs: "session" | "existing_customer" | "new_customer";

  if (!guestCheckout && session?.sub) {
    checkoutLinkedAs = "session";
    checkoutUserId = session.sub;
    checkoutEmail = normalizeEmail(session.email ?? email);
  } else {
    checkoutLinkedAs = "existing_customer";
  }
  /** When checkout creates a brand-new customer on this request, we email a set-password link in the order mail. */
  let newAccountPasswordSetup: { setupUrl: string } | null = null;

  if (!checkoutUserId) {
    const existingUser = await prisma.customers.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (existingUser) {
      checkoutLinkedAs = "existing_customer";
      checkoutUserId = existingUser.id;
      checkoutEmail = existingUser.email;
    } else {
      checkoutLinkedAs = "new_customer";
      const { raw: autoAccountSecret } = generatePasswordSetupSecret();
      const randomPasswordHash = await bcrypt.hash(autoAccountSecret, 12);
      const createdUser = await prisma.customers.create({
        data: {
          email,
          password_hash: randomPasswordHash,
          name: full_name || null,
          phone: phone || null,
          is_active: true,
        },
        select: { id: true, email: true },
      });
      checkoutUserId = createdUser.id;
      checkoutEmail = createdUser.email;

      try {
        const { raw: setupRaw, token_hash } = generatePasswordSetupSecret();
        await prisma.customer_password_setup_tokens.deleteMany({
          where: { customer_id: createdUser.id, used_at: null },
        });
        await prisma.customer_password_setup_tokens.create({
          data: {
            customer_id: createdUser.id,
            token_hash,
            expires_at: new Date(Date.now() + PASSWORD_SETUP_TTL_MS),
          },
        });
        const setupUrl = `${getSiteBaseUrl()}/set-password?token=${encodeURIComponent(setupRaw)}`;
        newAccountPasswordSetup = { setupUrl };
      } catch (tokenErr) {
        console.error(
          "[checkout] password setup token failed (run prisma migrate deploy?)",
          tokenErr
        );
      }
    }
  }

  const coupon = couponCode ? await fetchCouponForCart(couponCode) : null;

  const flashMap = await flashSalePriceMap(productIds);

  const lineItems = items.map((i) => {
    const p = productMap.get(i.productId)!;
    const catalogUnit = Number(p.discounted_price ?? p.base_price);
    const unit = unitPriceWithFlashSale(catalogUnit, p.id, flashMap);
    return {
      productId: p.id,
      productName: p.name,
      sku: p.sku ?? null,
      unitPrice: unit,
      quantity: i.quantity,
      subtotal: unit * i.quantity,
      shippingPerUnit: Math.max(0, Number(p.shipping_per_unit ?? 0)),
    };
  });

  const subtotal = lineItems.reduce((s, li) => s + li.subtotal, 0);
  let discount = 0;
  if (coupon) {
    const now = new Date();
    const timeErr = couponTimingError(coupon, now);
    if (timeErr) return NextResponse.json({ error: timeErr }, { status: 400 });

    const lineMeta = items.map((i) => {
      const p = productMap.get(i.productId)!;
      return { productId: p.id, categoryId: p.category_id };
    });
    const scopeErr = categoryScopeError(coupon.categoryIds, lineMeta);
    if (scopeErr) return NextResponse.json({ error: scopeErr }, { status: 400 });

    const minOk = coupon.min_cart_value != null ? subtotal >= coupon.min_cart_value : true;
    if (!minOk) return NextResponse.json({ error: "Coupon minimum not met" }, { status: 400 });

    const usageErr = await couponUsageErrors(coupon, checkoutUserId);
    if (usageErr) return NextResponse.json({ error: usageErr }, { status: 400 });

    // First-visit coupon is enforced one-time per customer/email regardless of browser storage.
    if (checkoutUserId) {
      const settings = await prisma.site_marketing_settings.findUnique({
        where: { id: SITE_MARKETING_SETTINGS_ID },
        select: { first_visit_coupon_code: true },
      });
      const firstVisitCode = (settings?.first_visit_coupon_code ?? "").trim().toUpperCase();
      if (firstVisitCode && coupon.code.toUpperCase() === firstVisitCode) {
        const usedFirstVisit = await prisma.coupon_usages.count({
          where: { coupon_id: coupon.id, customer_id: checkoutUserId },
        });
        if (usedFirstVisit > 0) {
          return NextResponse.json(
            { error: "First-visit offer already used for this email" },
            { status: 400 }
          );
        }
      }
    }

    discount = computeCouponDiscount(subtotal, coupon);
  }
  const totalBeforeShip = Math.max(0, subtotal - discount);
  const freeShippingThresholdInr = await getFreeShippingThresholdInr();
  const shippingAmount = orderShippingInrFromLines({
    subtotalBeforeDiscount: subtotal,
    lines: lineItems.map((li) => ({ quantity: li.quantity, shippingPerUnit: li.shippingPerUnit })),
    freeShippingThresholdInr,
  });
  const total = totalBeforeShip + shippingAmount;

  // Transaction: create address, order, items, reserve inventory.
  const order = await prisma.$transaction(async (tx) => {
    const addr = await tx.addresses.create({
      data: {
        customer_id: checkoutUserId,
        full_name,
        phone,
        line1,
        line2: address?.line2 ? String(address.line2) : null,
        city,
        state,
        postal_code,
        country,
        is_default_billing: false,
        is_default_shipping: false,
      },
      select: { id: true },
    });

    const createdOrder = await tx.orders.create({
      data: {
        customer_id: checkoutUserId,
        status: "PENDING",
        payment_status: "PENDING",
        subtotal_amount: subtotal,
        discount_amount: discount,
        shipping_amount: shippingAmount,
        tax_amount: 0,
        total_amount: total,
        currency: "INR",
        coupon_id: coupon?.id ?? null,
        shipping_address_id: addr.id,
        billing_address_id: addr.id,
        payment_provider: "placeholder",
        is_gift: isGift,
        gift_message: giftMessage,
      },
      select: { id: true },
    });

    for (const li of lineItems) {
      const oi = await tx.order_items.create({
        data: {
          order_id: createdOrder.id,
          product_id: li.productId,
          product_variant_id: null,
          product_name: li.productName,
          sku: li.sku,
          unit_price: li.unitPrice,
          quantity: li.quantity,
          subtotal_amount: li.subtotal,
        },
        select: { id: true },
      });

      // Reserve stock (product-level inventory row where variant is null)
      const updated = await tx.inventory.updateMany({
        where: {
          product_id: li.productId,
          product_variant_id: null,
          available_quantity: { gte: li.quantity },
        },
        data: {
          available_quantity: { decrement: li.quantity },
          reserved_quantity: { increment: li.quantity },
        },
      });
      if (updated.count !== 1) {
        throw new Error("OUT_OF_STOCK");
      }

      await tx.inventory_reservations.create({
        data: {
          order_id: createdOrder.id,
          order_item_id: oi.id,
          product_id: li.productId,
          product_variant_id: null,
          quantity: li.quantity,
        },
      });
    }

    return createdOrder;
  }, PRISMA_TRANSACTION_OPTIONS);

  // Best-effort low-stock alerting after reservation update.
  await syncLowStockAlertsByProductIds(lineItems.map((li) => li.productId)).catch((err) => {
    console.error("[checkout] low stock alert sync failed", err);
  });

  await writeAuditLog({
    customerId: checkoutUserId,
    entityType: "ORDER",
    entityId: order.id,
    action: "ORDER_CREATED_PENDING",
    newValues: { status: "PENDING" },
    ipAddress: req.ip ?? null,
    userAgent: req.headers.get("user-agent"),
  });

  if (checkoutEmail) {
    try {
      const passwordSetup = newAccountPasswordSetup
        ? { email: checkoutEmail, setupUrl: newAccountPasswordSetup.setupUrl }
        : undefined;
      const mailResult = await sendEmail({
        to: checkoutEmail,
        subject: newAccountPasswordSetup
          ? "Order received — set your password (see email)"
          : "Order created (pending payment)",
        html: orderPendingCustomerEmailHtml({
          orderId: order.id,
          passwordSetup,
        }),
        text: orderPendingCustomerEmailText({
          orderId: order.id,
          passwordSetup,
        }),
      });
      if (mailResult.skipped && newAccountPasswordSetup?.setupUrl) {
        console.warn(
          "[checkout] SMTP not configured (EMAIL_SERVER_* / EMAIL_FROM) — email skipped. Local set-password URL:\n%s",
          newAccountPasswordSetup.setupUrl
        );
      }
    } catch (err) {
      console.error("[checkout] order email failed", err);
    }
  }

  const accessToken = createOrderAccessToken(order.id);
  return NextResponse.json(
    {
      ok: true,
      orderId: order.id,
      accessToken,
      /** Checkout attached to session vs reused email vs new row this request. */
      checkoutLinkedAs,
      /** True when a one-time set-password URL was generated and included in the order email. */
      passwordSetupIncluded: Boolean(newAccountPasswordSetup),
      /** True when this request created a new `customers` row (may still lack password link if token DB failed). */
      newAccountCreated: checkoutLinkedAs === "new_customer",
    },
    { status: 201 }
  );
}

