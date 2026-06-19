/**
 * Set HSN 9503 and GST 5% on all products.
 *
 * Usage: npx tsx scripts/backfill-product-hsn-gst.ts
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

const HSN_CODE = "9503";
const GST_PERCENT = 5;

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.products.count();
  const missingBefore = await prisma.products.count({
    where: {
      OR: [{ hsn_code: null }, { gst_percent: null }],
    },
  });

  const result = await prisma.products.updateMany({
    data: {
      hsn_code: HSN_CODE,
      gst_percent: GST_PERCENT,
    },
  });

  console.log(`\n─── Product tax backfill ───`);
  console.log(`Products in DB:     ${before}`);
  console.log(`Missing HSN/GST:    ${missingBefore}`);
  console.log(`Updated rows:       ${result.count}`);
  console.log(`HSN:                ${HSN_CODE}`);
  console.log(`GST %:              ${GST_PERCENT}\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
