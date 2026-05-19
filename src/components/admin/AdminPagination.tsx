import Link from "next/link";
import { paginationItems } from "@/lib/shop/shopQuery";

type AdminPaginationProps = {
  currentPage: number;
  totalPages: number;
  pathname: string;
};

function pageHref(pathname: string, page: number) {
  return page <= 1 ? pathname : `${pathname}?page=${page}`;
}

const navBtn =
  "h-9 min-w-9 px-2 rounded-lg border border-gray-3 grid place-items-center text-sm font-medium";
const navBtnActive = `${navBtn} bg-white text-dark hover:bg-gray-1`;
const navBtnDisabled = `${navBtn} bg-gray-1 text-meta-4 pointer-events-none`;

export function AdminPagination({ currentPage, totalPages, pathname }: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const items = paginationItems(currentPage, totalPages);

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
      aria-label="Pagination"
    >
      {currentPage > 1 ? (
        <Link
          href={pageHref(pathname, currentPage - 1)}
          className={navBtnActive}
          aria-label="Previous page"
        >
          &lt;
        </Link>
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
          <Link
            key={item}
            href={pageHref(pathname, item)}
            className={`${navBtn} ${
              item === currentPage
                ? "bg-blue text-white border-blue"
                : "bg-white text-blue hover:bg-gray-1"
            }`}
            aria-current={item === currentPage ? "page" : undefined}
          >
            {item}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={pageHref(pathname, currentPage + 1)}
          className={navBtnActive}
          aria-label="Next page"
        >
          &gt;
        </Link>
      ) : (
        <span className={navBtnDisabled} aria-hidden>
          &gt;
        </span>
      )}
    </nav>
  );
}
