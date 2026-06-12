import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  const brands = await prisma.brands.findMany({
    where: { name: { in: ["Hot Wheels", "Hot Wheels Premium"] } },
    select: { id: true, name: true },
  });
  console.log("brands", brands);

  const excluded = await prisma.free_shipping_excluded_brands.findMany({
    select: { brand_id: true, brands: { select: { name: true } } },
  });
  console.log("excluded", excluded);

  const sample = await prisma.products.findMany({
    where: { name: { contains: "Hot Wheels Premium Formula 1", mode: "insensitive" } },
    take: 5,
    select: {
      id: true,
      name: true,
      brand_id: true,
      shipping_per_unit: true,
      brands: { select: { name: true } },
    },
  });
  console.log("products", sample);

  const threshold = await prisma.site_marketing_settings.findFirst({
    select: { free_shipping_threshold_inr: true },
  });
  console.log("threshold", threshold?.free_shipping_threshold_inr?.toString());

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
