import { createAnalyticsRoute } from "@/lib/ga4/routeHandler";
import { getUserBehaviour } from "@/lib/ga4/queries";

export const GET = createAnalyticsRoute("userBehaviour", getUserBehaviour);
