import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";

const paymentId = process.argv[2]?.trim();
if (!paymentId) {
  console.error("Usage: npx tsx scripts/check-razorpay-payment.ts <razorpay_payment_id>");
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();

  const order = await prisma.orders.findFirst({
    where: { external_payment_id: paymentId, payment_provider: "razorpay" },
    select: {
      id: true,
      order_number: true,
      status: true,
      payment_status: true,
      total_amount: true,
      created_at: true,
      customers: { select: { email: true, name: true } },
      order_items: { select: { product_name: true, quantity: true, subtotal_amount: true } },
    },
  });

  if (order) {
    console.log("Order found for payment:", paymentId);
    console.log(JSON.stringify(order, null, 2));
  } else {
    console.log("No order in DB for Razorpay payment:", paymentId);
    console.log(
      "This usually means POST /api/payment/razorpay/verify failed after payment was captured."
    );
    console.log("Check Hostinger runtime logs for [razorpay/verify] order creation failed");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
