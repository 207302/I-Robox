import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_REVIEW_REQUEST_DELAY_HOURS,
  resolveReviewRequestDelayHours,
} from "@/lib/marketing/reviewRequestSettings";
import { SITE_MARKETING_SETTINGS_ID } from "@/lib/marketing/siteSettingsId";

export type ReviewRequestSettings = {
  enabled: boolean;
  delayHours: number;
  delayMs: number;
  source: "db" | "default";
};

export async function getReviewRequestSettings(): Promise<ReviewRequestSettings> {
  try {
    const row = await prisma.site_marketing_settings.findUnique({
      where: { id: SITE_MARKETING_SETTINGS_ID },
      select: {
        review_request_emails_enabled: true,
        review_request_delay_hours: true,
      },
    });

    if (row) {
      const delayHours = resolveReviewRequestDelayHours(row.review_request_delay_hours);
      return {
        enabled: row.review_request_emails_enabled,
        delayHours,
        delayMs: delayHours * 60 * 60 * 1000,
        source: "db",
      };
    }
  } catch {
    /* column missing until migration is applied */
  }

  return {
    enabled: true,
    delayHours: DEFAULT_REVIEW_REQUEST_DELAY_HOURS,
    delayMs: DEFAULT_REVIEW_REQUEST_DELAY_HOURS * 60 * 60 * 1000,
    source: "default",
  };
}
