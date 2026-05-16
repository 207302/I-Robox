import { prisma } from "@/lib/prisma";

export type CartLineForCoupon = { productId: string; categoryId: string | null };

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
    },
  });
  if (!c) return null;
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
    categoryIds: c.coupon_categories.map((x) => x.category_id),
  };
}

export function categoryScopeError(categoryIds: string[], lines: CartLineForCoupon[]): string | null {
  if (categoryIds.length === 0) return null;
  const allowed = new Set(categoryIds);
  for (const line of lines) {
    if (!line.categoryId || !allowed.has(line.categoryId)) {
      return "Coupon does not apply to items in your cart";
    }
  }
  return null;
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
