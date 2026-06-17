"use client";
import { ModalProvider } from "../context/QuickViewModalContext";
import { ReduxProvider } from "@/redux/provider";
import { PreviewSliderProvider } from "../context/PreviewSliderContext";
import CartProvider from "@/components/Providers/CartProvider";
import CartHydration from "@/components/Providers/CartHydration";
import CartServerSync from "@/components/Providers/CartServerSync";
import { SessionProvider } from "@/components/Providers/SessionProvider";
import { PublicMarketingProvider } from "@/components/Providers/PublicMarketingProvider";
import type { PublicMarketingPayload } from "@/lib/marketing/publicMarketingTypes";
import dynamic from "next/dynamic";

import PopupWrapper from "@/components/Marketing/PopupWrapper";
import LaunchNotifyPopupDeferred from "@/components/Marketing/LaunchNotifyPopupDeferred";

const QuickViewModal = dynamic(() => import("@/components/Common/QuickViewModal"), { ssr: false });
const CartSidebarModal = dynamic(() => import("@/components/Common/CartSidebarModal"), {
  ssr: false,
});
const PreviewSliderModal = dynamic(() => import("@/components/Common/PreviewSlider"), {
  ssr: false,
});

type ProvidersProps = {
  children: React.ReactNode;
  initialMarketing: PublicMarketingPayload;
};

const Providers = ({ children, initialMarketing }: ProvidersProps) => {
  return (
    <ReduxProvider>
      <SessionProvider>
        <PublicMarketingProvider initialMarketing={initialMarketing}>
          <CartHydration />
          <CartServerSync />
          <CartProvider>
            <ModalProvider>
              <PreviewSliderProvider>
                <PopupWrapper />
                <LaunchNotifyPopupDeferred />
                {children}
                <QuickViewModal />
                <CartSidebarModal />
                <PreviewSliderModal />
              </PreviewSliderProvider>
            </ModalProvider>
          </CartProvider>
        </PublicMarketingProvider>
      </SessionProvider>
    </ReduxProvider>
  );
};

export default Providers;
