"use client";

import {
  endOfMonth,
  format,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type { DateRange } from "@/lib/ga4/types";

type PresetKey =
  | "today"
  | "last7"
  | "last30"
  | "last90"
  | "thisMonth"
  | "lastMonth"
  | "custom";

type DateRangePickerProps = {
  value: DateRange;
  onChange: (range: DateRange) => void;
};

function buildPreset(key: PresetKey): DateRange | null {
  const today = new Date();
  const endDate = format(today, "yyyy-MM-dd");

  switch (key) {
    case "today":
      return { startDate: endDate, endDate };
    case "last7":
      return { startDate: format(subDays(today, 6), "yyyy-MM-dd"), endDate };
    case "last30":
      return { startDate: format(subDays(today, 29), "yyyy-MM-dd"), endDate };
    case "last90":
      return { startDate: format(subDays(today, 89), "yyyy-MM-dd"), endDate };
    case "thisMonth":
      return {
        startDate: format(startOfMonth(today), "yyyy-MM-dd"),
        endDate,
      };
    case "lastMonth": {
      const prev = subMonths(today, 1);
      return {
        startDate: format(startOfMonth(prev), "yyyy-MM-dd"),
        endDate: format(endOfMonth(prev), "yyyy-MM-dd"),
      };
    }
    default:
      return null;
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "last90", label: "Last 90 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "custom", label: "Custom" },
];

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const activePreset =
    PRESETS.find((preset) => {
      if (preset.key === "custom") return false;
      const built = buildPreset(preset.key);
      return built?.startDate === value.startDate && built?.endDate === value.endDate;
    })?.key ?? "custom";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => {
              if (preset.key === "custom") return;
              const built = buildPreset(preset.key);
              if (built) onChange(built);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activePreset === preset.key
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400">
          From
          <input
            type="date"
            value={value.startDate}
            max={value.endDate}
            onChange={(event) =>
              onChange({ ...value, startDate: event.target.value })
            }
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          To
          <input
            type="date"
            value={value.endDate}
            min={value.startDate}
            max={format(new Date(), "yyyy-MM-dd")}
            onChange={(event) =>
              onChange({ ...value, endDate: event.target.value })
            }
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </label>
      </div>
    </div>
  );
}
