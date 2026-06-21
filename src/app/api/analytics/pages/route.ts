import { createAnalyticsRoute } from "@/lib/ga4/routeHandler";
import { getLandingPageAnalysis } from "@/lib/ga4/queries";

export const GET = createAnalyticsRoute("landingPageAnalysis", getLandingPageAnalysis);
