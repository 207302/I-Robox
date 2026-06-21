import { createAnalyticsRoute } from "@/lib/ga4/routeHandler";
import { getTrafficAcquisition } from "@/lib/ga4/queries";

export const GET = createAnalyticsRoute("trafficAcquisition", getTrafficAcquisition);
