import { DEFAULT_ACCENT_COLOR, parseHexColor } from "@/lib/marketing/accentColor";

/** Baked into `shop-search-car-loader.json` (default brand accent). */
const SOURCE_LOTTIE_RGB: [number, number, number] = [0.7686, 0.1176, 0.2275];

function hexToLottieRgba(hex: string): [number, number, number, number] {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    return [...SOURCE_LOTTIE_RGB, 1];
  }
  return [rgb.r / 255, rgb.g / 255, rgb.b / 255, 1];
}

function channelClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.02;
}

function isSourceLottieColor(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    channelClose(value[0], SOURCE_LOTTIE_RGB[0]) &&
    channelClose(value[1], SOURCE_LOTTIE_RGB[1]) &&
    channelClose(value[2], SOURCE_LOTTIE_RGB[2])
  );
}

function recolorNode(value: unknown, target: [number, number, number, number]): unknown {
  if (isSourceLottieColor(value)) {
    return target;
  }
  if (Array.isArray(value)) {
    return value.map((item) => recolorNode(item, target));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, recolorNode(child, target)])
    );
  }
  return value;
}

/** Replace default accent strokes/fills in a Lottie JSON with the storefront accent. */
export function recolorLottieAnimation<T>(animation: T, accentHex: string): T {
  const target = hexToLottieRgba(accentHex);
  return recolorNode(structuredClone(animation), target) as T;
}

export function readAccentColorFromDocument(): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT_COLOR;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--color-blue").trim();
  return raw || DEFAULT_ACCENT_COLOR;
}
