import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { loadActiveFlashSaleRules } from "@/lib/pricing/flashSale";
import {
  flashSaleClaimTag,
  resolveFlashSaleClaimRule,
  type FlashSaleRule,
} from "@/lib/pricing/flashSaleTypes";
import {
  FLASH_SALE_ALREADY_CLAIMED_MESSAGE,
  FLASH_SALE_ONE_ITEM_MESSAGE,
  flashSaleLimitReachedMessage,
  flashSaleQtyLimitMessage,
} from "@/lib/flashSale/messages";

export {
  FLASH_SALE_ALREADY_CLAIMED_MESSAGE,
  FLASH_SALE_ONE_ITEM_MESSAGE,
  FLASH_SALE_QTY_ONE_MESSAGE,
} from "@/lib/flashSale/messages";

export class FlashSaleClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlashSaleClaimError";
  }
}

export type FlashSaleCartClaim = {
  saleTag: string;
  flashSaleId: string;
  quantity: number;
  purchaseLimit: number;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** Resolve the flash-sale claim implied by cart lines (or null if none). */
export async function resolveFlashSaleCartClaim(
  lines: { productId: string; quantity: number }[],
  now = new Date()
): Promise<{ ok: true; claim: FlashSaleCartClaim | null } | { ok: false; error: string }> {
  if (lines.length === 0) return { ok: true, claim: null };

  const rules = await loadActiveFlashSaleRules(now);
  if (rules.length === 0) return { ok: true, claim: null };

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = await prisma.products.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      category_id: true,
      brand_id: true,
      base_price: true,
      discounted_price: true,
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const isLive = (rule: FlashSaleRule) =>
    isActiveInWindow(rule.is_active, rule.active_from, rule.active_until, now);

  let claim: FlashSaleCartClaim | null = null;
  for (const line of lines) {
    const product = productMap.get(line.productId);
    if (!product) continue;
    const catalogUnit = Number(product.discounted_price ?? product.base_price);
    const claimRule = resolveFlashSaleClaimRule(
      {
        id: product.id,
        category_id: product.category_id,
        brand_id: product.brand_id,
        catalog_unit: catalogUnit,
      },
      rules,
      isLive
    );
    if (!claimRule) continue;
    const qty = Math.max(0, Math.trunc(line.quantity));
    if (qty < 1) continue;
    const saleTag = flashSaleClaimTag(claimRule);
    if (claim && claim.saleTag !== saleTag) {
      return { ok: false, error: FLASH_SALE_ONE_ITEM_MESSAGE };
    }
    if (!claim) {
      claim = {
        saleTag,
        flashSaleId: claimRule.id,
        quantity: qty,
        purchaseLimit: claimRule.purchase_limit,
      };
    } else {
      claim.quantity += qty;
      claim.purchaseLimit = Math.min(claim.purchaseLimit, claimRule.purchase_limit);
    }
  }

  if (!claim) return { ok: true, claim: null };
  if (claim.quantity > claim.purchaseLimit) {
    return { ok: false, error: flashSaleQtyLimitMessage(claim.purchaseLimit) };
  }

  return { ok: true, claim };
}

export async function customerFlashSaleClaimedQuantity(
  customerId: string,
  saleTag: string,
  db: DbClient = prisma
): Promise<number> {
  const agg = await db.flash_sale_claims.aggregate({
    where: { customer_id: customerId, sale_tag: saleTag },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

export async function customerHasFlashSaleClaim(
  customerId: string,
  saleTag: string,
  db: DbClient = prisma
): Promise<boolean> {
  return (await customerFlashSaleClaimedQuantity(customerId, saleTag, db)) > 0;
}

export async function assertCustomerCanClaimFlashSale(
  customerId: string,
  claim: FlashSaleCartClaim | null,
  db: DbClient = prisma
): Promise<void> {
  if (!claim) return;
  const used = await customerFlashSaleClaimedQuantity(customerId, claim.saleTag, db);
  if (used + claim.quantity > claim.purchaseLimit) {
    throw new FlashSaleClaimError(
      used >= claim.purchaseLimit
        ? flashSaleLimitReachedMessage(claim.purchaseLimit)
        : flashSaleQtyLimitMessage(claim.purchaseLimit)
    );
  }
}

async function lockCustomerSaleTag(
  tx: Prisma.TransactionClient,
  customerId: string,
  saleTag: string
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${customerId}), hashtext(${saleTag}))`;
}

/** Create claim inside an order transaction. Throws FlashSaleClaimError when the limit is exceeded. */
export async function createFlashSaleClaimInTx(
  tx: Prisma.TransactionClient,
  input: {
    customerId: string;
    orderId: string;
    claim: FlashSaleCartClaim | null;
  }
): Promise<void> {
  if (!input.claim) return;
  await lockCustomerSaleTag(tx, input.customerId, input.claim.saleTag);
  await assertCustomerCanClaimFlashSale(input.customerId, input.claim, tx);
  try {
    await tx.flash_sale_claims.create({
      data: {
        customer_id: input.customerId,
        sale_tag: input.claim.saleTag,
        flash_sale_id: input.claim.flashSaleId,
        order_id: input.orderId,
        quantity: input.claim.quantity,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new FlashSaleClaimError(FLASH_SALE_ALREADY_CLAIMED_MESSAGE);
    }
    throw error;
  }
}

/** Resolve cart lines, assert eligibility, and create the claim for a new order. */
export async function claimFlashSaleForOrderInTx(
  tx: Prisma.TransactionClient,
  input: {
    customerId: string;
    orderId: string;
    lines: { productId: string; quantity: number }[];
  }
): Promise<void> {
  const resolved = await resolveFlashSaleCartClaim(input.lines);
  if (!resolved.ok) {
    throw new FlashSaleClaimError(resolved.error);
  }
  await createFlashSaleClaimInTx(tx, {
    customerId: input.customerId,
    orderId: input.orderId,
    claim: resolved.claim,
  });
}

export async function releaseFlashSaleClaimForOrder(
  orderId: string,
  db: DbClient = prisma
): Promise<void> {
  await db.flash_sale_claims.deleteMany({ where: { order_id: orderId } });
}

export async function listCustomerFlashSaleClaimUsage(
  customerId: string
): Promise<Record<string, number>> {
  const rows = await prisma.flash_sale_claims.groupBy({
    by: ["sale_tag"],
    where: { customer_id: customerId },
    _sum: { quantity: true },
  });
  const usage: Record<string, number> = {};
  for (const row of rows) {
    usage[row.sale_tag] = row._sum.quantity ?? 0;
  }
  return usage;
}

export async function listCustomerFlashSaleClaimTags(
  customerId: string
): Promise<string[]> {
  return Object.keys(await listCustomerFlashSaleClaimUsage(customerId));
}
