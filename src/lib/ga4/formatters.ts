import { CURRENCY_SYMBOL } from "./types";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

export function formatCurrency(value: number): string {
  return `${CURRENCY_SYMBOL}${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}m ${secs}s`;
}

export function formatChange(
  current: number,
  previous: number
): { value: number; direction: "up" | "down" | "flat" } {
  if (previous === 0) {
    if (current === 0) return { value: 0, direction: "flat" };
    return { value: 100, direction: "up" };
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 0.05) return { value: 0, direction: "flat" };
  return {
    value: Math.abs(change),
    direction: change > 0 ? "up" : "down",
  };
}

export function formatGaDate(date: string): string {
  if (date.length !== 8) return date;
  const y = date.slice(0, 4);
  const m = date.slice(4, 6);
  const d = date.slice(6, 8);
  return `${d} ${getMonthShort(m)}`;
}

function getMonthShort(month: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = Number(month) - 1;
  return months[idx] ?? month;
}

export function countryCodeToFlag(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code.split("").map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
  );
}
