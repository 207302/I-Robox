import {
  getCouponsForAdmin,
  getFlashSaleProducts,
  getMarketingPopups,
} from "@/lib/queries/marketing";
import MarketingDeferredSeedsClient from "./MarketingDeferredSeedsClient";

export default async function MarketingDeferredSeeds() {
  const [popups, flashSalesRaw, couponsRaw] = await Promise.all([
    getMarketingPopups(),
    getFlashSaleProducts(),
    getCouponsForAdmin(),
  ]);

  const flashSales = flashSalesRaw.map((row) => ({
    ...row,
    sale_price: Number(row.sale_price),
  }));

  const coupons = couponsRaw.map((c) => ({
    ...c,
    discount_value: Number(c.discount_value),
  }));

  return (
    <MarketingDeferredSeedsClient popups={popups} flashSales={flashSales} coupons={coupons} />
  );
}
