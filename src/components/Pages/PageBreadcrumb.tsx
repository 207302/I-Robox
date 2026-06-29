import Link from "next/link";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";

export type PageBreadcrumbItem = {
  label: string;
  href?: string;
};

type Props = {
  items: PageBreadcrumbItem[];
};

export default function PageBreadcrumb({ items }: Props) {
  return (
    <div className="overflow-hidden pt-[172px] sm:pt-[172px]">
      <div className="bg-gray-2">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 xl:px-0">
          <div className="flex h-12 items-center justify-start">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2">
                {items.map((item, index) => {
                  const isLast = index === items.length - 1;
                  return (
                    <li key={`${item.label}-${index}`} className="inline-flex min-w-0 max-w-full items-center">
                      {isLast || !item.href ? (
                        <span
                          className="truncate text-custom-sm font-medium leading-none text-blue"
                          aria-current={isLast ? "page" : undefined}
                        >
                          {item.label}
                        </span>
                      ) : (
                        <>
                          <Link
                            href={item.href}
                            prefetch={shouldPrefetchHref(item.href)}
                            className="text-custom-sm font-medium leading-none text-gray-600 transition-colors hover:text-blue"
                          >
                            {item.label}
                          </Link>
                          <span className="inline-flex items-center text-meta-3 leading-none">&gt;</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
