import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminWrite } from "@/lib/admin/rbac";
import {
  getMarketingAdminWave1,
  getMarketingAdminWave2,
  getMarketingAdminWave3,
} from "@/lib/queries/marketingAdminPage";
import { MarketingAdminDeferredProvider } from "./MarketingAdminContext";
import MarketingAdminClient from "./MarketingAdminClient";
import MarketingDeferredSeeds from "./MarketingDeferredSeeds";
import { resolveMarketingTab } from "@/lib/admin/marketingTab";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function MarketingAdminPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const initialTab = resolveMarketingTab(sp.tab);
  const auth = await requireAdminWrite();
  if (!auth.ok) redirect("/admin/login");

  const [
    { settings, categories, freeShippingExcludedBrandIds, codAllowedBrandIds, codAllowedCategoryIds },
    wave2,
    { products, brands },
  ] =
    await Promise.all([
      getMarketingAdminWave1(),
      getMarketingAdminWave2(),
      getMarketingAdminWave3(),
    ]);

  const { slides, highlights, brandRail, categoryTiles, announcements } = wave2;

  const productsPlain = products.map((p) => ({
    ...p,
    base_price: Number(p.base_price),
    discounted_price: p.discounted_price != null ? Number(p.discounted_price) : null,
  }));

  return (
    <MarketingAdminDeferredProvider>
      <MarketingAdminClient
        initial={{
          slides,
          highlights,
          brandRail,
          categoryTiles,
          announcements,
          settings,
          categories,
          freeShippingExcludedBrandIds,
          codAllowedBrandIds,
          codAllowedCategoryIds,
          products: productsPlain,
          brands,
          initialTab,
        }}
      />
      <Suspense fallback={null}>
        <MarketingDeferredSeeds />
      </Suspense>
    </MarketingAdminDeferredProvider>
  );
}
