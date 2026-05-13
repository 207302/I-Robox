import "./css/style.css";
import { Metadata } from "next";
import { getSeoSettings } from "@/get-api-data/seo-setting";
import GtmLazy from "@/components/Analytics/GtmLazy";
import { DM_Sans } from "next/font/google";
const dm_sans = DM_Sans({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});
const defaultFavicon = "/ChatGPT Image Mar 3, 2026, 09_17_53 PM.png";

export async function generateMetadata(): Promise<Metadata> {
  const seoSettings = await getSeoSettings();
  return {
    title: `${seoSettings?.siteTitle || "Home"} | i-Robox`,
    description:
      seoSettings?.metadescription ||
      "i-Robox – diecast models, collectibles & play. Shop online.",
    keywords: seoSettings?.metaKeywords || "diecast, collectibles, toys, i-Robox, hot wheels",
    openGraph: {
      images: seoSettings?.metaImage ? [seoSettings.metaImage] : [],
    },
    icons: {
      icon: seoSettings?.favicon || defaultFavicon,
      shortcut: seoSettings?.favicon || defaultFavicon,
      apple: seoSettings?.favicon || defaultFavicon,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const seoSettings = await getSeoSettings();
  return (
    <html lang="en">
      <body suppressHydrationWarning={true} className={dm_sans.variable}>
        {children}
        {seoSettings?.gtmId ? <GtmLazy gtmId={seoSettings.gtmId} /> : null}
      </body>
    </html>
  );
}
