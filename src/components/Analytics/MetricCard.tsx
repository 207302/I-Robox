import { formatChange } from "@/lib/ga4/formatters";
import type { MetricCardProps } from "@/lib/ga4/types";

export default function MetricCard({
  label,
  value,
  previousValue,
  formatter,
  prefix = "",
  suffix = "",
}: MetricCardProps) {
  const displayValue = formatter ? formatter(value) : `${prefix}${value}${suffix}`;
  const change =
    previousValue !== undefined ? formatChange(value, previousValue) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{displayValue}</p>
      {change && previousValue !== undefined ? (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span
            className={
              change.direction === "up"
                ? "text-emerald-600 dark:text-emerald-400"
                : change.direction === "down"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-500"
            }
          >
            {change.direction === "up" ? "↑" : change.direction === "down" ? "↓" : "→"}{" "}
            {change.value.toFixed(1)}%
          </span>
          <span className="text-slate-400 dark:text-slate-500">
            vs {formatter ? formatter(previousValue) : `${prefix}${previousValue}${suffix}`}
          </span>
        </div>
      ) : null}
    </div>
  );
}
