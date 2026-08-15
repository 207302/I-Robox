import { prisma } from "@/lib/prisma";
import { createRazorpayPaymentLink } from "@/lib/payments/razorpayPaymentLink";
import { displayEmailForCustomer } from "@/lib/auth/phoneAccount";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";

export async function attachRazorpayPaymentLinkToOrder(orderId: string) {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      status: true,
      payment_status: true,
      total_amount: true,
      razorpay_payment_link_id: true,
      razorpay_payment_link_url: true,
      razorpay_payment_link_expires_at: true,
      customers: { select: { email: true, name: true } },
      addresses_orders_shipping_address_idToaddresses: {
        select: { full_name: true, phone: true },
      },
    },
  });
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
  if (order.payment_status === "SUCCEEDED") {
    throw Object.assign(new Error("Order is already paid"), { status: 409 });
  }
  if (order.status === "CANCELLED") {
    throw Object.assign(new Error("Order is cancelled"), { status: 409 });
  }

  const existingUrl = order.razorpay_payment_link_url;
  const expiresAt = order.razorpay_payment_link_expires_at;
  if (existingUrl && expiresAt && expiresAt.getTime() > Date.now() + 5 * 60_000) {
    return {
      id: order.razorpay_payment_link_id,
      url: existingUrl,
      expiresAt: expiresAt.toISOString(),
      reused: true,
    };
  }

  const ship = order.addresses_orders_shipping_address_idToaddresses;
  const email = displayEmailForCustomer(order.customers?.email ?? "") ?? null;
  const created = await createRazorpayPaymentLink({
    orderId: order.id,
    orderNumber: order.order_number,
    amountInr: Number(order.total_amount),
    customerName: ship?.full_name || order.customers?.name || "Customer",
    customerEmail: email && !isSyntheticPhoneSignupEmail(email) ? email : null,
    customerPhone: ship?.phone || "",
  });

  await prisma.orders.update({
    where: { id: order.id },
    data: {
      razorpay_payment_link_id: created.id,
      razorpay_payment_link_url: created.url,
      razorpay_payment_link_expires_at: created.expiresAt,
      payment_provider: "razorpay",
      payment_status: "PENDING",
    },
  });

  return {
    id: created.id,
    url: created.url,
    expiresAt: created.expiresAt.toISOString(),
    reused: false,
  };
}
