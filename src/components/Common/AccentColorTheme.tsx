import { accentCssText } from "@/lib/marketing/accentColor";

type Props = {
  accentColor?: string | null;
};

/** Injects storefront accent CSS variables (customer site only — not used in admin). */
export default function AccentColorTheme({ accentColor }: Props) {
  const css = accentCssText(accentColor);
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
