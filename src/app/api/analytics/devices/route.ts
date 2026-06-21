import { createAnalyticsRoute } from "@/lib/ga4/routeHandler";
import { getDeviceData } from "@/lib/ga4/queries";

export const GET = createAnalyticsRoute("deviceData", getDeviceData);
