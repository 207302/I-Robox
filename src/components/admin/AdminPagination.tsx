import Link from "next/link";
import type { ReactNode } from "react";
import { paginationItems } from "@/lib/shop/shopQuery";

type AdminPaginationProps = {
  currentPage: number;
  totalPages: number;
  pathname: string;
  /** Preserved across pages when searching. */
  searchQuery?: string;
  /** Client-side pagination (buttons instead of URL links). */
  onPageChange?: (page: number) => void;
};

export function adminListPageHref(pathname: string, page: number, searchQuery?: string) {
  const params = new URLSearchParams();
  const q = searchQuery?.trim();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function pageHref(pathname: string, page: number, searchQuery?: string) {
  return adminListPageHref(pathname, page, searchQuery);
}

const navBtn =
  "h-9 min-w-9 px-2 rounded-lg border border-gray-3 grid place-items-center text-sm font-medium";
const navBtnActive = `${navBtn} bg-white text-dark hover:bg-gray-1`;
const navBtnDisabled = `${navBtn} bg-gray-1 text-meta-4 pointer-events-none`;

export function AdminPagination({
  currentPage,
  totalPages,
  pathname,
  searchQuery,
  onPageChange,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const items = paginationItems(currentPage, totalPages);
  const clientMode = Boolean(onPageChange);

  function PageControl({
    page,
    children,
    className,
    ariaLabel,
    ariaCurrent,
  }: {
    page: number;
    children: ReactNode;
    className: string;
    ariaLabel?: string;
    ariaCurrent?: boolean;
  }) {
    if (clientMode && onPageChange) {
      return (
        <button
          type="button"
          onClick={() => onPageChange(page)}
          className={className}
          aria-label={ariaLabel}
          aria-current={ariaCurrent ? "page" : undefined}
        >
          {children}
        </button>
      );
    }
    return (
      <Link
        href={pageHref(pathname, page, searchQuery)}
        className={className}
        aria-label={ariaLabel}
        aria-current={ariaCurrent ? "page" : undefined}
      >
        {children}
      </Link>
    );
  }

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
      aria-label="Pagination"
    >
      {currentPage > 1 ? (
        <PageControl page={currentPage - 1} className={navBtnActive} ariaLabel="Previous page">
          &lt;
        </PageControl>
      ) : (
        <span className={navBtnDisabled} aria-hidden>
          &lt;
        </span>
      )}

      {items.map((item, i) =>
        item === "ellipsis" ? (
          <span key={`e-${i}`} className="px-1 text-sm text-meta-4 select-none" aria-hidden>
            …
          </span>
        ) : (
          <PageControl
            key={item}
            page={item}
            className={`${navBtn} ${
              item === currentPage
                ? "bg-blue text-white border-blue"
                : "bg-white text-blue hover:bg-gray-1"
            }`}
            ariaCurrent={item === currentPage}
          >
            {item}
          </PageControl>
        )
      )}

      {currentPage < totalPages ? (
        <PageControl page={currentPage + 1} className={navBtnActive} ariaLabel="Next page">
          &gt;
        </PageControl>
      ) : (
        <span className={navBtnDisabled} aria-hidden>
          &gt;
        </span>
      )}
    </nav>
  );
}
