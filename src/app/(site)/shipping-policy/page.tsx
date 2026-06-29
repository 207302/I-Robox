import type { Metadata } from "next";
import QuickLinkContentPage from "@/components/Common/QuickLinkContentPage";

export const metadata: Metadata = {
  title: "Shipping Policy | i-Robox",
  description: "Shipping rates, delivery timelines, and free-shipping rules for i-Robox orders across India.",
};

export default function ShippingPolicyPage() {
  return (
    <QuickLinkContentPage
      title="Shipping Policy"
      subtitle="How we ship RC toys, diecast models, and collectibles across India."
      content={`We ship to serviceable pin codes across India through trusted courier partners.

Free shipping may apply when your order subtotal meets the minimum shown on the store (before discounts, where applicable). Below that threshold, shipping is calculated from product-level charges or standard flat rates at checkout.

Orders are typically dispatched after payment confirmation and verification. You will receive tracking details by email or SMS once your shipment is handed to the courier.

Delivery timelines vary by location and product availability. Remote or non-serviceable areas may take longer or require alternate arrangements.

For shipping questions about a specific order, visit Track Order or contact our support team.`}
    />
  );
}
