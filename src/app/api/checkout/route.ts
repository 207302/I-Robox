import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeSiteMarketingSettingsFindUnique } from "@/lib/db/safeReads";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { orderPendingCustomerEmailHtml, orderPendingCustomerEmailText, isEmailConfigured } from "@/lib/email";
import { loadOrderEmailLines } from "@/lib/email/orderEmailLines";
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
  couponDiscountFromLines,
  couponTimingError,
  couponUsageErrors,
  fetchCouponForCart,
} from "@/lib/coupons/cartCoupon";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";
import { syncLowStockAlertsByProductIds } from "@/lib/inventory/lowStockAlerts";
import { orderShippingInrFromLines } from "@/lib/checkout/orderShipping";
import {
  getFreeShippingExcludedBrandIds,
  getFreeShippingThresholdInr,
} from "@/lib/marketing/freeShipping";
import { getCodEligibilityForProducts } from "@/lib/checkout/cod";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";
import { allocateNextOrderNumber, formatOrderReference } from "@/lib/orders/orderNumber";
import { assertMaxOrderQuantities } from "@/lib/cart/maxOrderQuantity";
import { validateShippingAddress } from "@/lib/validation/address";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import {
  collectOrderNotificationEmails,
  sendEmailToRecipients,
} from "@/lib/orders/orderNotificationEmails";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { assertCartItemsInStock, StockValidationError } from "@/lib/inventory/cartStock";

type CheckoutItem = {
  productId: string;
  quantity: number;
};

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
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
    const paymentMethod = String(body.paymentMethod ?? "COD").trim().toUpperCase();
  
    const items = (Array.isArray(body.items) ? body.items : []) as CheckoutItem[];
    const address = (body.address ?? {}) as Record<string, unknown>;
    const isGift = Boolean(body.isGift);
    const giftMessage = cleanOptionalText(body.giftMessage, 500);
    const couponCode = cleanText(body.couponCode, 80);
  
    if (items.length === 0) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

    const addressValidated = validateShippingAddress(address);
    if (!addressValidated.ok) {
      return NextResponse.json({ error: addressValidated.error }, { status: 400 });
    }

    const email = normalizeEmail(address.email);
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!validateCommonEmailProvider(email)) {
      return NextResponse.json(
        { error: "Use a common email provider (Gmail, Yahoo, Outlook, etc.)" },
        { status: 400 }
      );
    }
    if (hasSuspiciousInput(email)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const {
      full_name,
      phone,
      line1,
      line2,
      city,
      state,
      postal_code,
      country,
    } = addressValidated.address;
  
    const guestCheckoutRequested = body.guestCheckout === true || body.guestCheckout === "true";
    let sessionEmailNorm = "";
    if (session?.sub) {
      const sessionCustomer = await prisma.customers.findUnique({
        where: { id: session.sub },
        select: { email: true },
      });
      if (sessionCustomer?.email && !isSyntheticPhoneSignupEmail(sessionCustomer.email)) {
        sessionEmailNorm = normalizeEmail(sessionCustomer.email);
      }
    }
    const emailMismatch =
      Boolean(session?.sub) && sessionEmailNorm.length > 0 && sessionEmailNorm !== email;
    const guestCheckout = guestCheckoutRequested || emailMismatch;
  
    if (
      [email, couponCode]
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
        brand_id: true,
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
    }
    try {
      assertMaxOrderQuantities(items, productMap);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("MAX_ORDER_QTY_EXCEEDED:")) {
        const [, productName, maxRaw] = msg.split(":");
        const maxQty = Number(maxRaw);
        return NextResponse.json(
          {
            error: Number.isFinite(maxQty)
              ? `${productName || "This item"} allows max ${maxQty} per order`
              : "One or more items exceed the per-order quantity limit",
          },
          { status: 400 }
        );
      }
      throw e;
    }
  
    let checkoutUserId: string | null = null;
    let checkoutEmail = email;
    let accountEmail: string | null = null;
    let checkoutLinkedAs: "session" | "existing_customer" | "new_customer";

    if (!guestCheckout && session?.sub) {
      checkoutLinkedAs = "session";
      checkoutUserId = session.sub;
      const registered = await prisma.customers.findUnique({
        where: { id: session.sub },
        select: { email: true },
      });
      const registeredEmail = registered?.email ?? null;
      if (registeredEmail && !isSyntheticPhoneSignupEmail(registeredEmail)) {
        accountEmail = normalizeEmail(registeredEmail);
      }
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

    if (paymentMethod !== "COD") {
      return NextResponse.json({ error: "Unsupported payment method" }, { status: 400 });
    }

    const codEligibility = await getCodEligibilityForProducts(
      dbProducts.map((p) => ({
        id: p.id,
        brand_id: p.brand_id ?? null,
        category_id: p.category_id ?? null,
      }))
    );
    if (!codEligibility.available) {
      return NextResponse.json(
        { error: codEligibility.reason ?? "Cash on Delivery is not available for these items." },
        { status: 400 }
      );
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
        brandId: p.brand_id,
      };
    });
  
    const subtotal = lineItems.reduce((s, li) => s + li.subtotal, 0);
    let discount = 0;
    if (coupon) {
      const now = new Date();
      const timeErr = couponTimingError(coupon, now);
      if (timeErr) return NextResponse.json({ error: timeErr }, { status: 400 });
  
      const couponLines = lineItems.map((li) => {
        const p = productMap.get(li.productId)!;
        return {
          productId: p.id,
          categoryId: p.category_id,
          brandId: p.brand_id,
          subtotal: li.subtotal,
        };
      });
      const { discount: scopedDiscount, error: discountErr } = couponDiscountFromLines(
        couponLines,
        coupon
      );
      if (discountErr) return NextResponse.json({ error: discountErr }, { status: 400 });
  
      const usageErr = await couponUsageErrors(coupon, checkoutUserId);
      if (usageErr) return NextResponse.json({ error: usageErr }, { status: 400 });
  
      // First-visit coupon is enforced one-time per customer/email regardless of browser storage.
      if (checkoutUserId) {
        const settings = await safeSiteMarketingSettingsFindUnique({
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
  
      discount = scopedDiscount;
    }
    const totalBeforeShip = Math.max(0, subtotal - discount);
    const [freeShippingThresholdInr, freeShippingExcludedBrandIds] = await Promise.all([
      getFreeShippingThresholdInr(),
      getFreeShippingExcludedBrandIds(),
    ]);
    const shippingAmount = orderShippingInrFromLines({
      subtotalBeforeDiscount: subtotal,
      lines: lineItems.map((li) => ({
        quantity: li.quantity,
        shippingPerUnit: li.shippingPerUnit,
        lineSubtotal: li.subtotal,
        brandId: li.brandId,
      })),
      freeShippingThresholdInr,
      freeShippingExcludedBrandIds,
    });
    const total = totalBeforeShip + shippingAmount;

    try {
      await assertCartItemsInStock(
        lineItems.map((li) => ({ productId: li.productId, quantity: li.quantity })),
        new Map(lineItems.map((li) => [li.productId, li.productName]))
      );
    } catch (e: unknown) {
      const msg =
        e instanceof StockValidationError
          ? e.message
          : "One or more items are out of stock";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  
    // Transaction: create address, order, items, reserve inventory.
    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
      const addr = await tx.addresses.create({
        data: {
          customer_id: checkoutUserId,
          full_name,
          phone,
          line1,
          line2,
          city,
          state,
          postal_code,
          country,
          is_default_billing: false,
          is_default_shipping: false,
        },
        select: { id: true },
      });
  
      const order_number = await allocateNextOrderNumber(tx);

      const createdOrder = await tx.orders.create({
        data: {
          order_number,
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
          payment_provider: "cod",
          is_gift: isGift,
          gift_message: giftMessage,
        },
        select: { id: true, order_number: true },
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "OUT_OF_STOCK") {
        return NextResponse.json(
          { error: "One or more items went out of stock. Please refresh your cart and try again." },
          { status: 400 }
        );
      }
      throw e;
    }
  
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
  
    const notificationRecipients = collectOrderNotificationEmails(checkoutEmail, accountEmail);
    if (notificationRecipients.length > 0) {
      try {
        const passwordSetup = newAccountPasswordSetup
          ? { email: checkoutEmail, setupUrl: newAccountPasswordSetup.setupUrl }
          : undefined;
        let orderLines: Awaited<ReturnType<typeof loadOrderEmailLines>> = [];
        try {
          orderLines = await loadOrderEmailLines(order.id);
        } catch (lineErr) {
          console.error("[checkout] order line images failed", lineErr);
        }
        const orderRef = formatOrderReference(order);
        await sendEmailToRecipients({
          recipients: notificationRecipients,
          subject: newAccountPasswordSetup
            ? "COD order received — set your password (see email)"
            : "COD order created (pending confirmation)",
          html: orderPendingCustomerEmailHtml({
            orderId: orderRef,
            lines: orderLines,
            passwordSetup,
          }),
          text: orderPendingCustomerEmailText({
            orderId: orderRef,
            lines: orderLines,
            passwordSetup,
          }),
        });
        if (!isEmailConfigured() && newAccountPasswordSetup?.setupUrl) {
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
        paymentMethod: "COD",
        /** Checkout attached to session vs reused email vs new row this request. */
        checkoutLinkedAs,
        /** True when a one-time set-password URL was generated and included in the order email. */
        passwordSetupIncluded: Boolean(newAccountPasswordSetup),
        /** True when this request created a new `customers` row (may still lack password link if token DB failed). */
        newAccountCreated: checkoutLinkedAs === "new_customer",
      },
      { status: 201 }
    );
  
  });}

