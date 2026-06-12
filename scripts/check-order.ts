import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { formatOrderReference } from "../src/lib/orders/orderNumber";

const orderId = process.argv[2];
if (!orderId) {
  console.error("Usage: npx tsx scripts/check-order.ts <order-id>");
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      order_number: true,
      status: true,
      payment_status: true,
      total_amount: true,
      subtotal_amount: true,
      discount_amount: true,
      shipping_amount: true,
      currency: true,
      created_at: true,
      updated_at: true,
      payment_provider: true,
      external_payment_id: true,
      shipments: {
        select: {
          status: true,
          tracking_number: true,
          carrier: true,
          shipped_at: true,
          delivered_at: true,
          updated_at: true,
        },
      },
      customer_id: true,
      customers: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          google_sub: true,
          is_active: true,
        },
      },
      order_items: {
        select: {
          product_name: true,
          quantity: true,
          unit_price: true,
          subtotal_amount: true,
        },
      },
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
    },
  });

  if (!order) {
    console.log(JSON.stringify({ found: false, orderId }, null, 2));
    await prisma.$disconnect();
    return;
  }

  console.log(
    JSON.stringify(
      {
        found: true,
        ref: formatOrderReference(order),
        ...order,
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
