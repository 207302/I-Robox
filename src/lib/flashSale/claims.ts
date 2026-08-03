import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { loadActiveFlashSaleRules } from "@/lib/pricing/flashSale";
import {
  bestFlashSaleMatch,
  flashSaleClaimTag,
  type FlashSaleRule,
} from "@/lib/pricing/flashSaleTypes";
import {
  FLASH_SALE_ALREADY_CLAIMED_MESSAGE,
  FLASH_SALE_ONE_ITEM_MESSAGE,
  FLASH_SALE_QTY_ONE_MESSAGE,
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
  productId: string;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** Resolve the single flash-sale claim implied by cart lines (or null if none). */
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

  const flashLines: FlashSaleCartClaim[] = [];
  for (const line of lines) {
    const product = productMap.get(line.productId);
    if (!product) continue;
    const catalogUnit = Number(product.discounted_price ?? product.base_price);
    const match = bestFlashSaleMatch(
      {
        id: product.id,
        category_id: product.category_id,
        brand_id: product.brand_id,
        catalog_unit: catalogUnit,
      },
      rules,
      isLive
    );
    if (!match) continue;
    if (line.quantity > 1) {
      return { ok: false, error: FLASH_SALE_QTY_ONE_MESSAGE };
    }
    flashLines.push({
      saleTag: flashSaleClaimTag(match.rule),
      flashSaleId: match.rule.id,
      productId: product.id,
    });
  }

  if (flashLines.length === 0) return { ok: true, claim: null };
  if (flashLines.length > 1) {
    return { ok: false, error: FLASH_SALE_ONE_ITEM_MESSAGE };
  }

  const claim = flashLines[0]!;
  const tags = new Set(flashLines.map((l) => l.saleTag));
  if (tags.size > 1) {
    return { ok: false, error: FLASH_SALE_ONE_ITEM_MESSAGE };
  }

  return { ok: true, claim };
}

export async function customerHasFlashSaleClaim(
  customerId: string,
  saleTag: string,
  db: DbClient = prisma
): Promise<boolean> {
  const existing = await db.flash_sale_claims.findUnique({
    where: {
      customer_id_sale_tag: { customer_id: customerId, sale_tag: saleTag },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function assertCustomerCanClaimFlashSale(
  customerId: string,
  claim: FlashSaleCartClaim | null,
  db: DbClient = prisma
): Promise<void> {
  if (!claim) return;
  const taken = await customerHasFlashSaleClaim(customerId, claim.saleTag, db);
  if (taken) {
    throw new FlashSaleClaimError(FLASH_SALE_ALREADY_CLAIMED_MESSAGE);
  }
}

/** Create claim inside an order transaction. Throws FlashSaleClaimError on duplicate. */
export async function createFlashSaleClaimInTx(
  tx: Prisma.TransactionClient,
  input: {
    customerId: string;
    orderId: string;
    claim: FlashSaleCartClaim | null;
  }
): Promise<void> {
  if (!input.claim) return;
  try {
    await tx.flash_sale_claims.create({
      data: {
        customer_id: input.customerId,
        sale_tag: input.claim.saleTag,
        flash_sale_id: input.claim.flashSaleId,
        order_id: input.orderId,
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

export async function listCustomerFlashSaleClaimTags(
  customerId: string
): Promise<string[]> {
  const rows = await prisma.flash_sale_claims.findMany({
    where: { customer_id: customerId },
    select: { sale_tag: true },
  });
  return rows.map((r) => r.sale_tag);
}
