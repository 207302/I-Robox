import { createAnalyticsRoute } from "@/lib/ga4/routeHandler";
import { getGeographicData } from "@/lib/ga4/queries";

export const GET = createAnalyticsRoute("geographicData", getGeographicData);
