"use client";

import dynamic from "next/dynamic";

const Breadcrumb = dynamic(() => import("@/components/Common/Breadcrumb"));

/** Breadcrumb is null on `/` — split chunk avoids loading it on the homepage. */
export default function BreadcrumbDeferred() {
  return <Breadcrumb />;
}
