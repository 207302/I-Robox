export type MarketingTab =
  | "hero"
  | "highlights"
  | "brandRail"
  | "categoryGrid"
  | "announcements"
  | "popups"
  | "flash"
  | "launchLeads"
  | "settings";

const MARKETING_TABS = new Set<string>([
  "hero",
  "highlights",
  "brandRail",
  "categoryGrid",
  "announcements",
  "popups",
  "flash",
  "launchLeads",
  "settings",
]);

/** Map admin URL ?tab= values to Marketing page tabs. */
export function resolveMarketingTab(raw?: string | null): MarketingTab | undefined {
  const key = raw?.trim();
  if (!key) return undefined;
  if (key === "shopPopup" || key === "shop-signups" || key === "launchLeads") {
    return "launchLeads";
  }
  if (MARKETING_TABS.has(key)) return key as MarketingTab;
  return undefined;
}
