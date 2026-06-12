import { prisma } from "@/lib/prisma";
import { expandCategoryIdsWithDescendants } from "@/lib/shop/categoryTree";

export type CartLineForCoupon = {
  productId: string;
  categoryId: string | null;
  brandId: string | null;
};

export type CartLineForCouponWithSubtotal = CartLineForCoupon & {
  subtotal: number;
};

export type CouponScope = {
  categoryIds: string[];
  brandIds: string[];
  productIds: string[];
};

export type CouponForCart = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_cart_value: number | null;
  starts_at: Date | null;
  ends_at: Date | null;
  max_uses: number | null;
  max_uses_per_user: number | null;
  categoryIds: string[];
  brandIds: string[];
  productIds: string[];
};

export async function fetchCouponForCart(code: string): Promise<CouponForCart | null> {
  const c = await prisma.coupons.findFirst({
    where: { code, is_active: true },
    select: {
      id: true,
      code: true,
      discount_type: true,
      discount_value: true,
      min_cart_value: true,
      starts_at: true,
      ends_at: true,
      max_uses: true,
      max_uses_per_user: true,
      coupon_categories: { select: { category_id: true } },
      coupon_brands: { select: { brand_id: true } },
      coupon_products: { select: { product_id: true } },
    },
  });
  if (!c) return null;
  const rawCategoryIds = c.coupon_categories.map((x) => x.category_id);
  const categoryIds = await expandCategoryIdsWithDescendants(rawCategoryIds);
  return {
    id: c.id,
    code: c.code,
    discount_type: c.discount_type,
    discount_value: Number(c.discount_value),
    min_cart_value: c.min_cart_value != null ? Number(c.min_cart_value) : null,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    max_uses: c.max_uses,
    max_uses_per_user: c.max_uses_per_user,
    categoryIds,
    brandIds: c.coupon_brands.map((x) => x.brand_id),
    productIds: c.coupon_products.map((x) => x.product_id),
  };
}

export function couponHasScope(scope: CouponScope): boolean {
  return scope.categoryIds.length > 0 || scope.brandIds.length > 0 || scope.productIds.length > 0;
}

export function lineMatchesCouponScope(line: CartLineForCoupon, scope: CouponScope): boolean {
  if (!couponHasScope(scope)) return true;

  const allowedCategories = new Set(scope.categoryIds);
  const allowedBrands = new Set(scope.brandIds);
  const allowedProducts = new Set(scope.productIds);

  const matches: boolean[] = [];
  if (scope.categoryIds.length > 0) {
    matches.push(line.categoryId != null && allowedCategories.has(line.categoryId));
  }
  if (scope.brandIds.length > 0) {
    matches.push(line.brandId != null && allowedBrands.has(line.brandId));
  }
  if (scope.productIds.length > 0) {
    matches.push(allowedProducts.has(line.productId));
  }

  // Inclusion lists are combined with OR — a line qualifies if it matches any configured scope.
  return matches.some(Boolean);
}

export function eligibleCouponLines<T extends CartLineForCoupon>(lines: T[], scope: CouponScope): T[] {
  if (!couponHasScope(scope)) return lines;
  return lines.filter((line) => lineMatchesCouponScope(line, scope));
}

export function couponDiscountFromLines(
  lines: CartLineForCouponWithSubtotal[],
  coupon: CouponForCart
): { discount: number; eligibleSubtotal: number; error: string | null } {
  const scope: CouponScope = {
    categoryIds: coupon.categoryIds,
    brandIds: coupon.brandIds,
    productIds: coupon.productIds,
  };
  const scoped = couponHasScope(scope);
  const eligible = eligibleCouponLines(lines, scope);
  const fullSubtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.subtotal, 0);

  if (scoped && eligible.length === 0) {
    return { discount: 0, eligibleSubtotal: 0, error: "Coupon does not apply to items in your cart" };
  }

  const minBase = scoped ? eligibleSubtotal : fullSubtotal;
  if (coupon.min_cart_value != null && minBase < coupon.min_cart_value) {
    return { discount: 0, eligibleSubtotal, error: "Coupon minimum not met" };
  }

  const discountBase = scoped ? eligibleSubtotal : fullSubtotal;
  return {
    discount: computeCouponDiscount(discountBase, coupon),
    eligibleSubtotal,
    error: null,
  };
}

/** @deprecated Use couponDiscountFromLines */
export function couponScopeError(scope: CouponScope, lines: CartLineForCoupon[]): string | null {
  if (!couponHasScope(scope)) return null;
  const eligible = eligibleCouponLines(lines, scope);
  if (eligible.length === 0) return "Coupon does not apply to items in your cart";
  return null;
}

/** @deprecated Use couponDiscountFromLines */
export function categoryScopeError(categoryIds: string[], lines: CartLineForCoupon[]): string | null {
  return couponScopeError({ categoryIds, brandIds: [], productIds: [] }, lines);
}

export function couponTimingError(c: CouponForCart, now: Date): string | null {
  if (c.starts_at && c.starts_at > now) return "Coupon is not active yet";
  if (c.ends_at && c.ends_at < now) return "Coupon has expired";
  return null;
}

export async function couponUsageErrors(
  c: CouponForCart,
  customerId: string | null
): Promise<string | null> {
  if (c.max_uses) {
    const used = await prisma.coupon_usages.count({ where: { coupon_id: c.id } });
    if (used >= c.max_uses) return "Coupon usage limit reached";
  }
  if (c.max_uses_per_user && customerId) {
    const usedByUser = await prisma.coupon_usages.count({
      where: { coupon_id: c.id, customer_id: customerId },
    });
    if (usedByUser >= c.max_uses_per_user) {
      return "Coupon usage limit reached for your account";
    }
  }
  return null;
}

export function computeCouponDiscount(subtotal: number, c: CouponForCart): number {
  if (c.discount_type === "PERCENTAGE") {
    return Math.round((subtotal * c.discount_value) / 100);
  }
  return Math.min(subtotal, c.discount_value);
}
