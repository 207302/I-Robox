import Link from "next/link";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";

type Props = {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  eyebrow?: string;
  subtitle?: string;
};

export default function HomeSectionHeader({
  title,
  viewAllHref,
  viewAllLabel = "View All",
  eyebrow,
  subtitle,
}: Props) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-bold text-dark md:text-[1.75rem]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-meta-3">{subtitle}</p> : null}
      </div>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          prefetch={shouldPrefetchHref(viewAllHref)}
          className="shrink-0 text-sm font-medium text-blue transition-colors hover:underline"
        >
          {viewAllLabel}
        </Link>
      ) : null}
    </div>
  );
}
