/** ISR + `unstable_cache` for `src/app/(site)/page.tsx` — keep in sync with `revalidate` there. */
export const HOME_PAGE_REVALIDATE_SECONDS = 60;

export { HOME_PAGE_TAG, MARKETING_TAG, ANNOUNCEMENTS_TAG, ORDERS_TAG } from "@/lib/cache/tags";

export {
  revalidateHomePage,
  revalidateMarketingSite,
  revalidateHomePageContent,
} from "@/lib/cache/revalidate";
