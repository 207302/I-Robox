import type { Metadata } from "next";
import Link from "next/link";
import QuickLinkContentPage from "@/components/Common/QuickLinkContentPage";

export const metadata: Metadata = {
  title: "Blog | i-Robox",
  description: "News, guides, and collector stories from i-Robox.",
};

export default function BlogPage() {
  return (
    <QuickLinkContentPage
      title="Blog"
      subtitle="RC builds, diecast spotlights, and collector guides — coming soon."
      content="We are preparing articles on new arrivals, hobby tips, and behind-the-scenes drops. Check back soon or join our newsletter on the homepage for updates."
    >
      <Link
        href="/"
        className="inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark"
      >
        Back to home
      </Link>
    </QuickLinkContentPage>
  );
}
