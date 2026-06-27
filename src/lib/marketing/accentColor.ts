/** Default brand accent (matches theme `blue` token). */
export const DEFAULT_ACCENT_COLOR = "#c41e3a";

type Rgb = { r: number; g: number; b: number };

export function parseHexColor(hex: string): Rgb | null {
  const trimmed = hex.trim();
  const match = /^#?([0-9a-f]{6})$/i.exec(trimmed);
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const clamp = (c: number) =>
    Math.round(Math.min(255, Math.max(0, c)))
      .toString(16)
      .padStart(2, "0");
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

function mixRgb(base: Rgb, target: Rgb, weight: number): Rgb {
  const w = Math.min(1, Math.max(0, weight));
  return {
    r: base.r * (1 - w) + target.r * w,
    g: base.g * (1 - w) + target.g * w,
    b: base.b * (1 - w) + target.b * w,
  };
}

function darken(hex: string, amount: number): string {
  const base = parseHexColor(hex);
  if (!base) return hex;
  return toHex(mixRgb(base, { r: 0, g: 0, b: 0 }, amount));
}

function lighten(hex: string, amount: number): string {
  const base = parseHexColor(hex);
  if (!base) return hex;
  return toHex(mixRgb(base, { r: 255, g: 255, b: 255 }, amount));
}

/** Resolved accent hex (falls back to default). */
export function resolveAccentHex(accent?: string | null): string {
  const trimmed = accent?.trim();
  if (trimmed && parseHexColor(trimmed)) return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return DEFAULT_ACCENT_COLOR;
}

/** CSS custom properties overriding Tailwind theme accent tokens. */
export function buildAccentCssVariables(accent?: string | null): Record<string, string> {
  const base = resolveAccentHex(accent);

  return {
    "--color-blue": base,
    "--color-blue-dark": darken(base, 0.2),
    "--color-blue-light": lighten(base, 0.12),
    "--color-blue-light-2": lighten(base, 0.24),
    "--color-blue-light-3": lighten(base, 0.36),
    "--color-blue-light-4": lighten(base, 0.48),
    "--color-blue-light-5": lighten(base, 0.6),
    "--color-red": base,
    "--color-red-dark": darken(base, 0.15),
    "--color-red-600": base,
    "--shadow-input": `inset 0 0 0 2px ${base}`,
  };
}

export function accentCssText(accent?: string | null): string {
  const vars = buildAccentCssVariables(accent);
  const body = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return `:root{${body}}`;
}
