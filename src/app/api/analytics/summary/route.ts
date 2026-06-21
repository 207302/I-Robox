import { createAnalyticsRoute } from "@/lib/ga4/routeHandler";
import { getExecutiveSummary } from "@/lib/ga4/queries";

export const GET = createAnalyticsRoute("executiveSummary", getExecutiveSummary);
