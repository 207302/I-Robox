import MarketingPopupPrelink from "@/components/Marketing/MarketingPopupPrelink";
import { getGuestPublicMarketingPayload } from "@/lib/marketing/publicMarketingPayload";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const marketing = await getGuestPublicMarketingPayload();
  return (
    <>
      <MarketingPopupPrelink imageUrl={marketing.popup?.image_url ?? null} />
      {children}
    </>
  );
}
