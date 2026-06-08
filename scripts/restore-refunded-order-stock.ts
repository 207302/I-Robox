/**
 * One-time backfill: restore available stock for orders already marked REFUNDED
 * before refund-time inventory restore existed.
 *
 * Usage:
 *   npm run inventory:restore-refunded -- --dry-run
 *   npm run inventory:restore-refunded
 *   npm run inventory:restore-refunded -- --order-id=<uuid>
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();
import { backfillRestoreSoldInventoryForRefundedOrders } from "../src/lib/inventory/orderInventoryRestore";
import { PRISMA_TRANSACTION_OPTIONS } from "../src/lib/prismaTransaction";

const prisma = new PrismaClient();

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function arg(name: string): string | null {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.split("=").slice(1).join("=") : null;
}

function printResult(result: Awaited<ReturnType<typeof backfillRestoreSoldInventoryForRefundedOrders>>) {
  const mode = result.dryRun ? "DRY RUN" : "APPLIED";
  console.log(`\n─── Refunded order stock backfill (${mode}) ───\n`);
  console.log(
    `Orders with restorable lines: ${result.orders.length} | restored lines: ${result.restoredLines} | skipped lines: ${result.skippedLines}`
  );

  for (const order of result.orders) {
    console.log(`\n${order.orderNumber} (${order.orderId})`);
    for (const line of order.lines) {
      if (line.action !== "restored") continue;
      const before =
        line.soldBefore !== undefined && line.availableBefore !== undefined
          ? ` sold ${line.soldBefore}→${line.soldBefore - line.quantity}, avail ${line.availableBefore}→${line.availableBefore + line.quantity}`
          : "";
      console.log(`  + restore ${line.quantity} for product ${line.productId}${before}`);
    }
  }

  if (result.dryRun) {
    console.log("\nNo changes written. Re-run without --dry-run to apply.\n");
  } else if (result.restoredLines > 0) {
    console.log(`\nUpdated stock for ${result.productIds.length} product(s).\n`);
  } else {
    console.log("\nNothing to restore — stock may already be correct.\n");
  }
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const orderId = arg("order-id")?.trim() || null;

  const result = await prisma.$transaction(
    async (tx) =>
      backfillRestoreSoldInventoryForRefundedOrders(tx, {
        dryRun,
        orderIds: orderId ? [orderId] : undefined,
      }),
    PRISMA_TRANSACTION_OPTIONS
  );

  printResult(result);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
