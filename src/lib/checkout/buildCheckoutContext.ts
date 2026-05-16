import { prisma } from "@/lib/prisma";
import { validateCommonEmailProvider } from "@/lib/validateEmai";
import {
  cleanOptionalText,
  cleanText,
  hasSuspiciousInput,
  isUuid,
  normalizeEmail,
  normalizePhone,
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
import { getSiteBaseUrl } from "@/lib/siteUrl";
import { orderShippingInrFromLines } from "@/lib/checkout/orderShipping";
import { getFreeShippingThresholdInr } from "@/lib/marketing/freeShipping";
import { generatePasswordSetupSecret, PASSWORD_SETUP_TTL_MS } from "@/lib/auth/passwordSetupToken";
import bcrypt from "bcrypt";

type CheckoutItem = {
  productId: string;
  quantity: number;
};

type SessionLike = {
  sub?: string | null;
  email?: string | null;
} | null;

export type CheckoutContext = {
  checkoutUserId: string | null;
  checkoutEmail: string;
  checkoutLinkedAs: "session" | "existing_customer" | "new_customer";
  newAccountPasswordSetup: { setupUrl: string } | null;
  lineItems: {
    productId: string;
    productName: string;
    sku: string | null;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    shippingPerUnit: number;
  }[];
  coupon: { id: string; code: string } | null;
  shipping: number;
  subtotal: number;
  discount: number;
  total: number;
  address: {
    full_name: string;
    phone: string;
    email: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  isGift: boolean;
  giftMessage: string | null;
};

export async function buildCheckoutContext(input: {
  body: Record<string, unknown>;
  session: SessionLike;
}) {
  const { body, session } = input;
  const items = (Array.isArray(body.items) ? body.items : []) as CheckoutItem[];
  const address = (body.address ?? {}) as Record<string, unknown>;
  const isGift = Boolean(body.isGift);
  const giftMessage = cleanOptionalText(body.giftMessage, 500);
  const couponCode = cleanText(body.couponCode, 80);

  if (items.length === 0) throw new Error("CART_EMPTY");

  const full_name = cleanText(address.full_name, 150);
  const phone = normalizePhone(address.phone);
  const email = normalizeEmail(address.email);
  const line1 = cleanText(address.line1, 255);
  const line2 = cleanOptionalText(address.line2, 255);
  const city = cleanText(address.city, 120);
  const state = cleanText(address.state, 120);
  const postal_code = cleanText(address.postal_code, 20);
  const country = cleanText(address.country ?? "India", 80);

  if (!full_name || !phone || !email || !line1 || !city || !state || !postal_code || !country) {
    throw new Error("ADDRESS_INCOMPLETE");
  }
  if (!validateCommonEmailProvider(email)) {
    throw new Error("EMAIL_PROVIDER_INVALID");
  }

  if (
    [full_name, phone, email, line1, city, state, postal_code, country, couponCode]
      .filter(Boolean)
      .some((v) => hasSuspiciousInput(v))
  ) {
    throw new Error("INVALID_INPUT");
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
    if (!isUuid(String(item.productId ?? "")) || !productMap.has(item.productId)) {
      throw new Error("INVALID_ITEMS");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("INVALID_QUANTITY");
    }
    const p = productMap.get(item.productId)!;
    const maxOrderQty = Math.max(1, Number(p.max_order_quantity ?? 99));
    if (item.quantity > maxOrderQty) {
      throw new Error(`MAX_ORDER_QTY_EXCEEDED:${p.name}:${maxOrderQty}`);
    }
  }

  let checkoutUserId: string | null = null;
  let checkoutEmail = email;
  let checkoutLinkedAs: "session" | "existing_customer" | "new_customer";

  const guestCheckout = false;

  if (!guestCheckout && session?.sub) {
    checkoutLinkedAs = "session";
    checkoutUserId = session.sub;
    checkoutEmail = normalizeEmail(session.email ?? email);
  } else {
    checkoutLinkedAs = "existing_customer";
  }

  let newAccountPasswordSetup: { setupUrl: string } | null = null;
  if (!checkoutUserId) {
    const existingUser = await prisma.customers.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (existingUser) {
      checkoutUserId = existingUser.id;
      checkoutEmail = existingUser.email;
      checkoutLinkedAs = "existing_customer";
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

      // Password-setup link is best-effort. If this fails (for example missing migration on an
      // environment), do not block paid order creation.
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
        newAccountPasswordSetup = {
          setupUrl: `${getSiteBaseUrl()}/set-password?token=${encodeURIComponent(setupRaw)}`,
        };
      } catch (tokenErr) {
        console.error(
          "[checkout-context] password setup token failed (run prisma migrate deploy?)",
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

  // Validate product-level inventory before creating a payment order so users do not pay for
  // items that cannot be reserved/confirmed later.
  const qtyByProduct = new Map<string, number>();
  for (const li of lineItems) {
    qtyByProduct.set(li.productId, (qtyByProduct.get(li.productId) ?? 0) + li.quantity);
  }
  const invRows = await prisma.inventory.findMany({
    where: {
      product_id: { in: [...qtyByProduct.keys()] },
      product_variant_id: null,
    },
    select: { product_id: true, available_quantity: true },
  });
  const invMap = new Map(invRows.map((r) => [r.product_id, r.available_quantity]));
  for (const [productId, requiredQty] of qtyByProduct.entries()) {
    const available = invMap.get(productId) ?? 0;
    if (available < requiredQty) {
      throw new Error("OUT_OF_STOCK");
    }
  }

  const subtotal = lineItems.reduce((s, li) => s + li.subtotal, 0);
  let discount = 0;

  if (coupon) {
    const now = new Date();
    const timeErr = couponTimingError(coupon, now);
    if (timeErr) throw new Error(timeErr);
    const lineMeta = items.map((i) => {
      const p = productMap.get(i.productId)!;
      return { productId: p.id, categoryId: p.category_id };
    });
    const scopeErr = categoryScopeError(coupon.categoryIds, lineMeta);
    if (scopeErr) throw new Error(scopeErr);
    const minOk = coupon.min_cart_value != null ? subtotal >= coupon.min_cart_value : true;
    if (!minOk) throw new Error("Coupon minimum not met");
    const usageErr = await couponUsageErrors(coupon, checkoutUserId);
    if (usageErr) throw new Error(usageErr);

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
          throw new Error("First-visit offer already used for this email");
        }
      }
    }

    discount = computeCouponDiscount(subtotal, coupon);
  }

  const freeShippingThresholdInr = await getFreeShippingThresholdInr();
  const shipping = orderShippingInrFromLines({
    subtotalBeforeDiscount: subtotal,
    lines: lineItems.map((li) => ({ quantity: li.quantity, shippingPerUnit: li.shippingPerUnit })),
    freeShippingThresholdInr,
  });
  const total = Math.max(0, subtotal - discount) + shipping;

  return {
    checkoutUserId,
    checkoutEmail,
    checkoutLinkedAs,
    newAccountPasswordSetup,
    lineItems,
    coupon: coupon ? { id: coupon.id, code: coupon.code } : null,
    shipping,
    subtotal,
    discount,
    total,
    address: { full_name, phone, email, line1, line2, city, state, postal_code, country },
    isGift,
    giftMessage,
  } satisfies CheckoutContext;
}
