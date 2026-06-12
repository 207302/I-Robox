import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.toLowerCase();
const phone = process.argv[3]?.replace(/\D/g, "") ?? "";

async function main() {
  if (!email && !phone) {
    console.error("Usage: npx tsx scripts/check-customer-orders.ts <email> [phone]");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const byEmail = email
    ? await prisma.customers.findMany({
        where: { email },
        select: {
          id: true,
          email: true,
          phone: true,
          google_sub: true,
          is_active: true,
          created_at: true,
        },
      })
    : [];
  const byPhone = phone
    ? await prisma.customers.findMany({
        where: { phone },
        select: {
          id: true,
          email: true,
          phone: true,
          google_sub: true,
          is_active: true,
          created_at: true,
        },
      })
    : [];
  const ids = [...new Set([...byEmail, ...byPhone].map((c) => c.id))];
  const orders = ids.length
    ? await prisma.orders.findMany({
        where: { customer_id: { in: ids } },
        select: {
          id: true,
          order_number: true,
          customer_id: true,
          status: true,
          payment_status: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      })
    : [];
  console.log(JSON.stringify({ byEmail, byPhone, orders }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
