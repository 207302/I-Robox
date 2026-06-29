import { prisma } from "@/lib/prisma";
import type { CheckoutContext } from "@/lib/checkout/buildCheckoutContext";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";

export async function buildCheckoutContextFromOrder(orderId: string): Promise<CheckoutContext | null> {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      customer_id: true,
      subtotal_amount: true,
      discount_amount: true,
      shipping_amount: true,
      total_amount: true,
      is_gift: true,
      gift_message: true,
      coupons: { select: { id: true, code: true } },
      customers: { select: { email: true } },
      addresses_orders_shipping_address_idToaddresses: {
        select: {
          full_name: true,
          phone: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          postal_code: true,
          country: true,
        },
      },
      order_items: {
        select: {
          product_id: true,
          product_name: true,
          sku: true,
          unit_price: true,
          quantity: true,
          subtotal_amount: true,
          products: { select: { shipping_per_unit: true } },
        },
      },
    },
  });

  const address = order?.addresses_orders_shipping_address_idToaddresses;
  if (!order || !address) return null;

  const customerEmail = order.customers?.email ?? "";
  const accountEmail =
    customerEmail && !isSyntheticPhoneSignupEmail(customerEmail) ? customerEmail : null;

  return {
    checkoutUserId: order.customer_id,
    checkoutEmail: accountEmail ?? "",
    accountEmail,
    checkoutLinkedAs: "session",
    newAccountPasswordSetup: null,
    lineItems: order.order_items.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      sku: item.sku,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      subtotal: Number(item.subtotal_amount),
      shippingPerUnit: Math.max(0, Number(item.products?.shipping_per_unit ?? 0)),
    })),
    coupon: order.coupons ? { id: order.coupons.id, code: order.coupons.code } : null,
    shipping: Number(order.shipping_amount),
    subtotal: Number(order.subtotal_amount),
    discount: Number(order.discount_amount),
    total: Number(order.total_amount),
    address: {
      full_name: address.full_name,
      phone: address.phone,
      email: accountEmail ?? "",
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
    },
    isGift: order.is_gift,
    giftMessage: order.gift_message,
  };
}
