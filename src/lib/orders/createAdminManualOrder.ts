import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";
import { allocateNextOrderNumber } from "@/lib/orders/orderNumber";
import {
  confirmReservedInventoryAsSold,
  reserveInventoryForLine,
} from "@/lib/orders/createFailedOrderFromCheckoutContext";
import { validateShippingAddress } from "@/lib/validation/address";
import { cleanText, isUuid, normalizeEmail } from "@/lib/validation/input";
import { findCustomerPhoneConflict, displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import {
  indianMobileErrorMessage,
  isValidIndianMobile,
  normalizeIndianMobileDigits,
} from "@/lib/auth/indianMobile";
import { generatePasswordSetupSecret } from "@/lib/auth/passwordSetupToken";
import { isSyntheticPhoneSignupEmail, syntheticEmailForPhone } from "@/lib/auth/signupIdentifier";
import { validateCommonEmailProvider } from "@/lib/validateEmai";
import { orderShippingInrFromLines } from "@/lib/checkout/orderShipping";
import {
  getFreeShippingExcludedBrandIds,
  getFreeShippingThresholdInr,
} from "@/lib/marketing/freeShipping";
import { writeAuditLog } from "@/lib/audit";
import { createRazorpayPaymentLink } from "@/lib/payments/razorpayPaymentLink";

export type AdminManualOrderItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export type AdminManualOrderAddressInput = {
  full_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
};

export type CreateAdminManualOrderInput = {
  adminUserId: string;
  customerId?: string | null;
  newCustomer?: { name: string; phone: string; email?: string | null } | null;
  items: AdminManualOrderItemInput[];
  address: AdminManualOrderAddressInput;
  generatePaymentLink?: boolean;
};

function money(n: number) {
  return Math.round(n * 100) / 100;
}

export async function createAdminManualOrder(input: CreateAdminManualOrderInput) {
  if (!input.items.length) {
    throw Object.assign(new Error("Add at least one product"), { status: 400 });
  }

  const addressValidated = validateShippingAddress({
    ...input.address,
    country: input.address.country || "India",
  });
  if (!addressValidated.ok) {
    throw Object.assign(new Error(addressValidated.error), { status: 400 });
  }
  const address = addressValidated.address;

  let customerId = input.customerId && isUuid(input.customerId) ? input.customerId : null;
  if (!customerId) {
    const created = await createAdminCustomerRecord(input.newCustomer ?? null, address);
    customerId = created.id;
  } else {
    const existing = await prisma.customers.findUnique({
      where: { id: customerId },
      select: { id: true, is_active: true },
    });
    if (!existing?.is_active) {
      throw Object.assign(new Error("Customer not found"), { status: 404 });
    }
  }

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await prisma.products.findMany({
    where: { id: { in: productIds }, is_active: true },
    select: {
      id: true,
      name: true,
      sku: true,
      base_price: true,
      discounted_price: true,
      shipping_per_unit: true,
      brand_id: true,
      inventory: {
        where: { product_variant_id: null },
        select: { available_quantity: true },
        take: 1,
      },
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const lines: {
    productId: string;
    productName: string;
    sku: string | null;
    catalogUnit: number;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    shippingPerUnit: number;
    brandId: string | null;
    overridden: boolean;
  }[] = [];

  for (const item of input.items) {
    if (!isUuid(item.productId)) {
      throw Object.assign(new Error("One or more products are invalid"), { status: 400 });
    }
    const product = productMap.get(item.productId);
    if (!product) {
      throw Object.assign(new Error("One or more products are invalid"), { status: 400 });
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw Object.assign(new Error("Invalid quantity"), { status: 400 });
    }
    const available = product.inventory[0]?.available_quantity ?? 0;
    if (item.quantity > available) {
      throw Object.assign(
        new Error(`${product.name} has only ${available} in stock`),
        { status: 409 }
      );
    }
    const catalogUnit = money(Number(product.discounted_price ?? product.base_price));
    const unitPrice =
      item.unitPrice != null && Number.isFinite(Number(item.unitPrice))
        ? money(Number(item.unitPrice))
        : catalogUnit;
    if (unitPrice < 0 || unitPrice > 1_000_000) {
      throw Object.assign(new Error("Invalid unit price"), { status: 400 });
    }
    lines.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku ?? null,
      catalogUnit,
      unitPrice,
      quantity: item.quantity,
      subtotal: money(unitPrice * item.quantity),
      shippingPerUnit: Math.max(0, Number(product.shipping_per_unit ?? 0)),
      brandId: product.brand_id,
      overridden: unitPrice !== catalogUnit,
    });
  }

  const subtotal = money(lines.reduce((s, li) => s + li.subtotal, 0));
  const [freeShippingThresholdInr, freeShippingExcludedBrandIds] = await Promise.all([
    getFreeShippingThresholdInr(),
    getFreeShippingExcludedBrandIds(),
  ]);
  const shipping = orderShippingInrFromLines({
    subtotalBeforeDiscount: subtotal,
    lines: lines.map((li) => ({
      quantity: li.quantity,
      shippingPerUnit: li.shippingPerUnit,
      lineSubtotal: li.subtotal,
      brandId: li.brandId,
    })),
    freeShippingThresholdInr,
    freeShippingExcludedBrandIds,
  });
  const total = money(subtotal + shipping);
  const generatePaymentLink = Boolean(input.generatePaymentLink);

  const created = await prisma.$transaction(async (tx) => {
    const addr = await tx.addresses.create({
      data: {
        customer_id: customerId,
        full_name: address.full_name,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country,
        is_default_billing: false,
        is_default_shipping: false,
      },
      select: { id: true },
    });

    const order_number = await allocateNextOrderNumber(tx);
    const order = await tx.orders.create({
      data: {
        order_number,
        customer_id: customerId,
        status: "PENDING",
        payment_status: generatePaymentLink ? "PENDING" : "SUCCEEDED",
        subtotal_amount: subtotal,
        discount_amount: 0,
        shipping_amount: shipping,
        tax_amount: 0,
        total_amount: total,
        currency: "INR",
        shipping_address_id: addr.id,
        billing_address_id: addr.id,
        payment_provider: generatePaymentLink ? "razorpay" : "manual",
        created_by_admin_id: input.adminUserId,
      },
      select: { id: true, order_number: true, customer_id: true },
    });

    for (const li of lines) {
      const oi = await tx.order_items.create({
        data: {
          order_id: order.id,
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
      await reserveInventoryForLine(tx, order.id, oi.id, {
        productId: li.productId,
        productName: li.productName,
        sku: li.sku,
        unitPrice: li.unitPrice,
        quantity: li.quantity,
        subtotal: li.subtotal,
        shippingPerUnit: li.shippingPerUnit,
      });
    }

    if (!generatePaymentLink) {
      await confirmReservedInventoryAsSold(order.id, tx);
    }

    await tx.customers.update({
      where: { id: customerId },
      data: {
        ...(address.phone ? { phone: address.phone } : {}),
        ...(address.full_name ? { name: address.full_name } : {}),
      },
    });

    return order;
  }, PRISMA_TRANSACTION_OPTIONS);

  for (const li of lines) {
    if (!li.overridden) continue;
    await writeAuditLog({
      adminUserId: input.adminUserId,
      entityType: "ORDER",
      entityId: created.id,
      action: "ORDER_LINE_PRICE_OVERRIDE",
      newValues: {
        productId: li.productId,
        productName: li.productName,
        originalPrice: li.catalogUnit,
        overriddenPrice: li.unitPrice,
        quantity: li.quantity,
        adminId: input.adminUserId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  await writeAuditLog({
    adminUserId: input.adminUserId,
    customerId,
    entityType: "ORDER",
    entityId: created.id,
    action: "ADMIN_MANUAL_ORDER_CREATED",
    newValues: {
      generatePaymentLink,
      payment_status: generatePaymentLink ? "PENDING" : "SUCCEEDED",
      total,
    },
  });

  let paymentLink: { id: string; url: string; expiresAt: Date } | null = null;
  let paymentLinkError: string | null = null;
  if (generatePaymentLink) {
    try {
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
        select: { email: true, name: true },
      });
      const email = displayEmailForCustomer(customer?.email ?? "") ?? null;
      paymentLink = await createRazorpayPaymentLink({
        orderId: created.id,
        orderNumber: created.order_number,
        amountInr: total,
        customerName: address.full_name || customer?.name || "Customer",
        customerEmail: email && !isSyntheticPhoneSignupEmail(email) ? email : null,
        customerPhone: address.phone,
      });
      await prisma.orders.update({
        where: { id: created.id },
        data: {
          razorpay_payment_link_id: paymentLink.id,
          razorpay_payment_link_url: paymentLink.url,
          razorpay_payment_link_expires_at: paymentLink.expiresAt,
        },
      });
    } catch (err) {
      paymentLinkError = err instanceof Error ? err.message : "Could not generate payment link";
      console.error("[admin-manual-order] payment link failed", { orderId: created.id, err });
    }
  }

  return {
    orderId: created.id,
    orderNumber: created.order_number,
    customerId,
    subtotal,
    shipping,
    total,
    paymentStatus: generatePaymentLink ? "PENDING" : "SUCCEEDED",
    paymentLink: paymentLink
      ? { id: paymentLink.id, url: paymentLink.url, expiresAt: paymentLink.expiresAt.toISOString() }
      : null,
    paymentLinkError,
    productIds,
  };
}

async function createAdminCustomerRecord(
  newCustomer: { name: string; phone: string; email?: string | null } | null,
  address: { full_name: string; phone: string }
) {
  const name = cleanText(newCustomer?.name || address.full_name, 150);
  const phoneDigits = normalizeIndianMobileDigits(newCustomer?.phone || address.phone);
  if (!name) throw Object.assign(new Error("Customer name is required"), { status: 400 });
  if (!phoneDigits || !isValidIndianMobile(phoneDigits)) {
    throw Object.assign(new Error(indianMobileErrorMessage()), { status: 400 });
  }

  const conflict = await findCustomerPhoneConflict(phoneDigits);
  if (conflict) {
    throw Object.assign(
      new Error("A customer with this phone number already exists — search and select them instead"),
      { status: 409 }
    );
  }

  let email = normalizeEmail(newCustomer?.email);
  if (email) {
    if (!validateCommonEmailProvider(email)) {
      throw Object.assign(
        new Error("Use a common email provider (Gmail, Yahoo, Outlook, etc.)"),
        { status: 400 }
      );
    }
    const existingEmail = await prisma.customers.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingEmail) {
      throw Object.assign(new Error("A customer with this email already exists"), { status: 409 });
    }
  } else {
    email = syntheticEmailForPhone(phoneDigits);
  }

  const { raw: autoSecret } = generatePasswordSetupSecret();
  const password_hash = await bcrypt.hash(autoSecret, 12);
  return prisma.customers.create({
    data: {
      email,
      password_hash,
      name,
      phone: phoneDigits,
      is_active: true,
    },
    select: { id: true, email: true },
  });
}

export function isHttpError(err: unknown): err is Error & { status: number } {
  return err instanceof Error && typeof (err as { status?: unknown }).status === "number";
}
