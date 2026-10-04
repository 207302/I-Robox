import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isActiveInWindow } from "@/lib/marketing/isActiveInWindow";
import { loadActiveFlashSaleRules } from "@/lib/pricing/flashSale";
import {
  bestFlashSaleMatch,
  flashSaleClaimTag,
  limitedFlashSalesForProduct,
  type FlashSaleRule,
} from "@/lib/pricing/flashSaleTypes";
import {
  FLASH_SALE_ALREADY_CLAIMED_MESSAGE,
  flashSaleLimitReachedMessage,
  flashSaleQtyLimitMessage,
  flashSaleRemainingMessage,
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

/** Units of one limited flash sale bought in a single order. */
export type FlashSaleCartClaim = {
  saleTag: string;
  flashSaleId: string;
  saleName?: string | null;
  quantity: number;
  purchaseLimit: number;
};

export type FlashSaleCartLine = { productId: string; quantity: number };

export type FlashSaleCartResolution =
  | { ok: true; unitPrices: Map<string, number>; claims: FlashSaleCartClaim[] }
  | { ok: false; error: string };

/** Who a flash-sale limit applies to: the account and the shipping phone (across accounts). */
export type FlashSaleClaimant = {
  customerId: string;
  phone?: string | null;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/**
 * Price cart lines and work out which limited flash sales they draw from, using one uncached
 * read of the sale rules so the price charged and the limit enforced always come from the same
 * sale definitions. Every unit of a product covered by a limited sale counts toward that sale,
 * even if another (unlimited) sale or the catalog supplies the price.
 */
export async function resolveFlashSaleCart(
  lines: FlashSaleCartLine[],
  now = new Date()
): Promise<FlashSaleCartResolution> {
  const unitPrices = new Map<string, number>();
  if (lines.length === 0) return { ok: true, unitPrices, claims: [] };

  const rules = await loadActiveFlashSaleRules(now, { fresh: true });
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

  for (const product of products) {
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
    unitPrices.set(product.id, match?.unitPrice ?? catalogUnit);
  }

  const bySale = new Map<string, FlashSaleCartClaim>();
  for (const line of lines) {
    const product = productMap.get(line.productId);
    if (!product) continue;
    const qty = Math.max(0, Math.trunc(line.quantity));
    if (qty < 1) continue;
    for (const rule of limitedFlashSalesForProduct(product, rules, isLive)) {
      const saleTag = flashSaleClaimTag(rule);
      const existing = bySale.get(saleTag);
      if (existing) {
        existing.quantity += qty;
      } else {
        bySale.set(saleTag, {
          saleTag,
          flashSaleId: rule.id,
          saleName: rule.name ?? null,
          quantity: qty,
          purchaseLimit: rule.purchase_limit,
        });
      }
    }
  }

  const claims = [...bySale.values()].sort((a, b) => a.saleTag.localeCompare(b.saleTag));
  for (const claim of claims) {
    if (claim.quantity > claim.purchaseLimit) {
      return { ok: false, error: flashSaleQtyLimitMessage(claim.purchaseLimit, claim.saleName) };
    }
  }

  return { ok: true, unitPrices, claims };
}

/** Limited-sale claims implied by cart lines (prices ignored). */
export async function resolveFlashSaleCartClaims(
  lines: FlashSaleCartLine[],
  now = new Date()
): Promise<{ ok: true; claims: FlashSaleCartClaim[] } | { ok: false; error: string }> {
  const resolved = await resolveFlashSaleCart(lines, now);
  if (!resolved.ok) return resolved;
  return { ok: true, claims: resolved.claims };
}

/** Last 10 digits of a phone number, or null when it is too short to identify a buyer. */
export function flashSaleClaimPhone(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export async function customerFlashSaleClaimedQuantity(
  claimant: FlashSaleClaimant,
  saleTag: string,
  db: DbClient = prisma
): Promise<number> {
  const phone = flashSaleClaimPhone(claimant.phone);
  const agg = await db.flash_sale_claims.aggregate({
    where: {
      sale_tag: saleTag,
      OR: [{ customer_id: claimant.customerId }, ...(phone ? [{ phone }] : [])],
    },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

export async function customerHasFlashSaleClaim(
  claimant: FlashSaleClaimant,
  saleTag: string,
  db: DbClient = prisma
): Promise<boolean> {
  return (await customerFlashSaleClaimedQuantity(claimant, saleTag, db)) > 0;
}

export async function assertCustomerCanClaimFlashSales(
  claimant: FlashSaleClaimant,
  claims: FlashSaleCartClaim[],
  db: DbClient = prisma
): Promise<void> {
  for (const claim of claims) {
    const used = await customerFlashSaleClaimedQuantity(claimant, claim.saleTag, db);
    if (used + claim.quantity <= claim.purchaseLimit) continue;
    const remaining = claim.purchaseLimit - used;
    throw new FlashSaleClaimError(
      remaining <= 0
        ? flashSaleLimitReachedMessage(claim.purchaseLimit, claim.saleName)
        : flashSaleRemainingMessage(claim.purchaseLimit, remaining, claim.saleName)
    );
  }
}

async function lockClaimant(
  tx: Prisma.TransactionClient,
  claimant: FlashSaleClaimant,
  claims: FlashSaleCartClaim[]
): Promise<void> {
  const phone = flashSaleClaimPhone(claimant.phone);
  const keys: [string, string][] = [];
  for (const claim of claims) {
    keys.push([`customer:${claimant.customerId}`, claim.saleTag]);
    if (phone) keys.push([`phone:${phone}`, claim.saleTag]);
  }
  // A single global lock order keeps concurrent checkouts from deadlocking.
  keys.sort((a, b) => `${a[0]}|${a[1]}`.localeCompare(`${b[0]}|${b[1]}`));
  for (const [identity, saleTag] of keys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identity}), hashtext(${saleTag}))`;
  }
}

/** Record claims inside an order transaction. Throws FlashSaleClaimError when a limit is exceeded. */
export async function createFlashSaleClaimsInTx(
  tx: Prisma.TransactionClient,
  input: {
    claimant: FlashSaleClaimant;
    orderId: string;
    claims: FlashSaleCartClaim[];
  }
): Promise<void> {
  if (input.claims.length === 0) return;
  await lockClaimant(tx, input.claimant, input.claims);
  await assertCustomerCanClaimFlashSales(input.claimant, input.claims, tx);
  const phone = flashSaleClaimPhone(input.claimant.phone);
  try {
    await tx.flash_sale_claims.createMany({
      data: input.claims.map((claim) => ({
        customer_id: input.claimant.customerId,
        phone,
        sale_tag: claim.saleTag,
        flash_sale_id: claim.flashSaleId,
        order_id: input.orderId,
        quantity: claim.quantity,
      })),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new FlashSaleClaimError(FLASH_SALE_ALREADY_CLAIMED_MESSAGE);
    }
    throw error;
  }
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
