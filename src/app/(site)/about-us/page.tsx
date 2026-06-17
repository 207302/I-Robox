import type { Metadata } from "next";
import QuickLinkContentPage from "@/components/Common/QuickLinkContentPage";
import { getQuickLinkPageContent } from "@/lib/marketing/quickLinkPages";

export const metadata: Metadata = {
  title: "About Us | i-Robox",
  description: "Learn about i-Robox — RC toys, diecast models, and collectibles delivered across India.",
};

export default async function AboutUsPage() {
  const page = await getQuickLinkPageContent("about");
  return <QuickLinkContentPage title={page.title} subtitle={page.subtitle} content={page.content} />;
}
