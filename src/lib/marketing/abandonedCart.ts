export const DEFAULT_ABANDONED_CART_IDLE_HOURS = 48;
export const MIN_ABANDONED_CART_IDLE_HOURS = 1;
export const MAX_ABANDONED_CART_IDLE_HOURS = 168;

export function resolveAbandonedCartIdleHours(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_ABANDONED_CART_IDLE_HOURS;
  }
  return Math.min(
    MAX_ABANDONED_CART_IDLE_HOURS,
    Math.max(MIN_ABANDONED_CART_IDLE_HOURS, Math.round(value))
  );
}
