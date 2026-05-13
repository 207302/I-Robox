"use client";

import NextTopLoader from "nextjs-toploader";

export default function SiteTopLoader() {
  return (
    <NextTopLoader
      color="#2563eb"
      crawlSpeed={300}
      showSpinner={false}
      shadow="none"
    />
  );
}
