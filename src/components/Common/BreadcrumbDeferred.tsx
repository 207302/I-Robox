"use client";

import Breadcrumb from "@/components/Common/Breadcrumb";

/** Breadcrumb is null on `/` — static import keeps SSR markup for stable layout (CLS). */
export default function BreadcrumbDeferred() {
  return <Breadcrumb />;
}
