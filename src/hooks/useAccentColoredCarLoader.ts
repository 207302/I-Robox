"use client";

import { useEffect, useState } from "react";
import carLoaderAnimation from "@/assets/animations/shop-search-car-loader.json";
import {
  readAccentColorFromDocument,
  recolorLottieAnimation,
} from "@/lib/lottie/recolorLottie";
import { DEFAULT_ACCENT_COLOR } from "@/lib/marketing/accentColor";

export function useAccentColoredCarLoader() {
  const [animationData, setAnimationData] = useState(() =>
    recolorLottieAnimation(carLoaderAnimation, DEFAULT_ACCENT_COLOR)
  );

  useEffect(() => {
    setAnimationData(
      recolorLottieAnimation(carLoaderAnimation, readAccentColorFromDocument())
    );
  }, []);

  return animationData;
}
