import { createAnalyticsRoute } from "@/lib/ga4/routeHandler";
import { getEcommercePerformance } from "@/lib/ga4/queries";

export const GET = createAnalyticsRoute("ecommercePerformance", getEcommercePerformance);
