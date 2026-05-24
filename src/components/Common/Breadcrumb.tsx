"use client";

import type React from "react";

import Link from "next/link";

import { usePathname } from "next/navigation";

// Define the breadcrumb item type
export interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  homeLabel?: string;
  homeHref?: string;
  separator?: React.ReactNode;
}

const Breadcrumb = ({
  items,
  homeLabel = "Home",
  homeHref = "/",
  separator = ">",
}: BreadcrumbProps) => {
  const pathname = usePathname();

  // If we're on the homepage, don't render the breadcrumb
  if (pathname === "/") return null;

  // If no items are provided, generate them from the current path
  const breadcrumbItems =
    items || generateBreadcrumbsFromPath(pathname, homeLabel, homeHref);

  return (
    <div className="overflow-hidden pt-[172px] sm:pt-[172px]">
      <div className="bg-gray-2">
        <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
          <div className="flex h-12 items-center justify-start">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2">
                {breadcrumbItems.map((item, index) => {
                  const isLast = index === breadcrumbItems.length - 1;

                  return (
                    <li key={item.href} className="inline-flex items-center">
                      {isLast ? (
                        <span
                          className="text-custom-sm font-medium leading-none text-blue"
                          aria-current="page"
                        >
                          {item.label}
                        </span>
                      ) : (
                        <>
                          <Link
                            href={item.href}
                            prefetch={false}
                            className="text-custom-sm font-medium leading-none text-gray-600 transition-colors hover:text-blue"
                          >
                            {item.label}
                          </Link>
                          <span className="inline-flex items-center text-meta-3 leading-none">
                            {separator}
                          </span>
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
};

export default Breadcrumb;

// Helper function to generate breadcrumbs from the current path
function generateBreadcrumbsFromPath(
  pathname: string,
  homeLabel = "Home",
  homeHref = "/"
): BreadcrumbItem[] {
  // Start with home
  const breadcrumbs: BreadcrumbItem[] = [{ label: homeLabel, href: homeHref }];

  // Skip the first slash and split the path
  const pathSegments = pathname.split("/").filter(Boolean);

  // Build up the breadcrumb items
  let currentPath = "";

  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;

    // Format the label (capitalize, replace hyphens with spaces)
    const label = segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    breadcrumbs.push({
      label,
      href: currentPath,
    });
  });

  return breadcrumbs;
}
