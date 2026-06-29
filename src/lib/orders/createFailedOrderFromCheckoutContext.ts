import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CheckoutContext } from "@/lib/checkout/buildCheckoutContext";
import { allocateNextOrderNumber } from "@/lib/orders/orderNumber";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/prismaTransaction";

const OUT_OF_STOCK_PREFIX = "OUT_OF_STOCK:";

type Tx = Prisma.TransactionClient;

export async function createFailedOrderFromCheckoutContext(
  ctx: CheckoutContext,
  razorpayCheckoutOrderId: string
): Promise<{ id: string; order_number: string; customer_id: string | null }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.orders.findFirst({
      where: { razorpay_checkout_order_id: razorpayCheckoutOrderId },
      select: { id: true, order_number: true, customer_id: true },
    });
    if (existing) {
      await tx.orders.update({
        where: { id: existing.id },
        data: {
          status: "PAYMENT_FAILED",
          payment_status: "FAILED",
          payment_provider: "razorpay",
        },
      });
      return existing;
    }

    const addr = await tx.addresses.create({
      data: {
        customer_id: ctx.checkoutUserId,
        full_name: ctx.address.full_name,
        phone: ctx.address.phone,
        line1: ctx.address.line1,
        line2: ctx.address.line2,
        city: ctx.address.city,
        state: ctx.address.state,
        postal_code: ctx.address.postal_code,
        country: ctx.address.country,
        is_default_billing: false,
        is_default_shipping: false,
      },
      select: { id: true },
    });

    const order_number = await allocateNextOrderNumber(tx);
    const order = await tx.orders.create({
      data: {
        order_number,
        customer_id: ctx.checkoutUserId,
        status: "PAYMENT_FAILED",
        payment_status: "FAILED",
        subtotal_amount: ctx.subtotal,
        discount_amount: ctx.discount,
        shipping_amount: ctx.shipping,
        tax_amount: 0,
        total_amount: ctx.total,
        currency: "INR",
        coupon_id: ctx.coupon?.id ?? null,
        shipping_address_id: addr.id,
        billing_address_id: addr.id,
        payment_provider: "razorpay",
        razorpay_checkout_order_id: razorpayCheckoutOrderId,
        is_gift: ctx.isGift,
        gift_message: ctx.giftMessage,
      },
      select: { id: true, order_number: true, customer_id: true },
    });

    for (const li of ctx.lineItems) {
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

      await reserveInventoryForLine(tx, order.id, oi.id, li);
    }

    return order;
  }, PRISMA_TRANSACTION_OPTIONS);
}

async function reserveInventoryForLine(
  tx: Tx,
  orderId: string,
  orderItemId: string,
  li: CheckoutContext["lineItems"][number]
) {
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
    throw new Error(`${OUT_OF_STOCK_PREFIX}${li.productName}`);
  }

  await tx.inventory_reservations.create({
    data: {
      order_id: orderId,
      order_item_id: orderItemId,
      product_id: li.productId,
      product_variant_id: null,
      quantity: li.quantity,
    },
  });
}

export async function releaseOrderInventoryReservations(orderId: string): Promise<string[]> {
  const productIds: string[] = [];
  await prisma.$transaction(async (tx) => {
    const reservations = await tx.inventory_reservations.findMany({
      where: { order_id: orderId, released_at: null },
      select: { id: true, product_id: true, product_variant_id: true, quantity: true },
    });
    productIds.push(...reservations.map((r) => r.product_id));

    for (const r of reservations) {
      await tx.inventory.updateMany({
        where: {
          product_id: r.product_id,
          product_variant_id: r.product_variant_id,
          reserved_quantity: { gte: r.quantity },
        },
        data: {
          reserved_quantity: { decrement: r.quantity },
          available_quantity: { increment: r.quantity },
        },
      });
      await tx.inventory_reservations.update({
        where: { id: r.id },
        data: { released_at: new Date() },
      });
    }
  }, PRISMA_TRANSACTION_OPTIONS);
  return [...new Set(productIds)];
}

export async function confirmReservedInventoryAsSold(orderId: string, tx: Tx) {
  const reservations = await tx.inventory_reservations.findMany({
    where: { order_id: orderId, released_at: null },
    select: { id: true, product_id: true, product_variant_id: true, quantity: true },
  });

  for (const r of reservations) {
    await tx.inventory.updateMany({
      where: {
        product_id: r.product_id,
        product_variant_id: r.product_variant_id,
        reserved_quantity: { gte: r.quantity },
      },
      data: {
        reserved_quantity: { decrement: r.quantity },
        sold_quantity: { increment: r.quantity },
      },
    });
    await tx.inventory_reservations.update({
      where: { id: r.id },
      data: { released_at: new Date() },
    });
  }
}
