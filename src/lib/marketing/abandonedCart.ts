export const DEFAULT_ABANDONED_CART_IDLE_MINUTES = 48 * 60;
export const MIN_ABANDONED_CART_IDLE_MINUTES = 6;
export const MAX_ABANDONED_CART_IDLE_MINUTES = 168 * 60;

/** Minimum idle hours accepted in admin (0.1 h = 6 min). */
export const MIN_ABANDONED_CART_IDLE_HOURS = MIN_ABANDONED_CART_IDLE_MINUTES / 60;
export const MAX_ABANDONED_CART_IDLE_HOURS = MAX_ABANDONED_CART_IDLE_MINUTES / 60;
export const DEFAULT_ABANDONED_CART_IDLE_HOURS = DEFAULT_ABANDONED_CART_IDLE_MINUTES / 60;

export function resolveAbandonedCartIdleMinutes(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_ABANDONED_CART_IDLE_MINUTES;
  }
  return Math.min(
    MAX_ABANDONED_CART_IDLE_MINUTES,
    Math.max(MIN_ABANDONED_CART_IDLE_MINUTES, Math.round(value))
  );
}

/** Admin input in hours (supports decimals like 0.5, 0.1). */
export function abandonedCartIdleMinutesFromHours(hours: number | null | undefined): number {
  if (hours == null || !Number.isFinite(hours)) {
    return DEFAULT_ABANDONED_CART_IDLE_MINUTES;
  }
  return resolveAbandonedCartIdleMinutes(hours * 60);
}

export function abandonedCartIdleHoursFromMinutes(minutes: number | null | undefined): number {
  return resolveAbandonedCartIdleMinutes(minutes) / 60;
}
