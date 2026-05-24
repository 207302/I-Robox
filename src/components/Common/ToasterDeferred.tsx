"use client";

import dynamic from "next/dynamic";
import type { ToasterProps } from "react-hot-toast";

const Toaster = dynamic(
  () => import("react-hot-toast").then((mod) => ({ default: mod.Toaster })),
  { ssr: false }
);

/** Defers toast UI bundle until after first paint (not on LCP critical path). */
export default function ToasterDeferred(props: ToasterProps) {
  return <Toaster {...props} />;
}
