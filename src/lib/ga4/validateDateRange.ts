import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import type { DateRange } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateRangeParams(
  startDate: string | null,
  endDate: string | null
): { ok: true; range: DateRange } | { ok: false; error: string } {
  if (!startDate || !endDate) {
    return { ok: false, error: "startDate and endDate query params are required (YYYY-MM-DD)." };
  }
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    return { ok: false, error: "Dates must use YYYY-MM-DD format." };
  }

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (!isValid(start) || !isValid(end)) {
    return { ok: false, error: "Invalid date value." };
  }
  if (start > end) {
    return { ok: false, error: "startDate must be on or before endDate." };
  }

  const today = format(new Date(), "yyyy-MM-dd");
  if (endDate > today) {
    return { ok: false, error: "endDate cannot be in the future." };
  }

  const spanDays = differenceInCalendarDays(end, start) + 1;
  if (spanDays > 366) {
    return { ok: false, error: "Date range cannot exceed 366 days." };
  }

  return { ok: true, range: { startDate, endDate } };
}

export function getPreviousDateRange(range: DateRange): DateRange {
  const start = parseISO(range.startDate);
  const end = parseISO(range.endDate);
  const spanDays = differenceInCalendarDays(end, start) + 1;
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (spanDays - 1));
  return {
    startDate: format(previousStart, "yyyy-MM-dd"),
    endDate: format(previousEnd, "yyyy-MM-dd"),
  };
}
