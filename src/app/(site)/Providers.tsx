"use client";
import { ModalProvider } from "../context/QuickViewModalContext";
import { ReduxProvider } from "@/redux/provider";
import { PreviewSliderProvider } from "../context/PreviewSliderContext";
import CartProvider from "@/components/Providers/CartProvider";
import CartHydration from "@/components/Providers/CartHydration";
import CartServerSync from "@/components/Providers/CartServerSync";
import dynamic from "next/dynamic";

const MarketingSiteEffects = dynamic(
  () => import("@/components/Marketing/MarketingSiteEffects").then((m) => m.default),
  { ssr: false }
);

const QuickViewModal = dynamic(() => import("@/components/Common/QuickViewModal"), { ssr: false });
const CartSidebarModal = dynamic(() => import("@/components/Common/CartSidebarModal"), {
  ssr: false,
});
const PreviewSliderModal = dynamic(() => import("@/components/Common/PreviewSlider"), {
  ssr: false,
});

const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ReduxProvider>
      <CartHydration />
      <CartServerSync />
      <CartProvider>
        <ModalProvider>
          <PreviewSliderProvider>
            <MarketingSiteEffects />
            {children}
            <QuickViewModal />
            <CartSidebarModal />
            <PreviewSliderModal />
          </PreviewSliderProvider>
        </ModalProvider>
      </CartProvider>
    </ReduxProvider>
  );
};

export default Providers;
