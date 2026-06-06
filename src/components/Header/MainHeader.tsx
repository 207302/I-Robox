"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { throttle } from "@/lib/perf/throttle";
import { useCart } from "@/hooks/useCart";
import { buildHeaderMenuData } from "./menuData";
import type { HeaderNavData } from "@/lib/nav/headerNav";
import MobileMenu from "./MobileMenu";
import DesktopMenu from "./DesktopMenu";
import {
  SearchIcon,
  UserIcon,
  HeartIcon,
  CartIcon,
  MenuIcon,
  CloseIcon,
} from "./icons";
import { useAppSelector } from "@/redux/store";
import toast from "react-hot-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { SEARCH_DEBOUNCE_MS } from "@/lib/shop/shopConstants";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import dynamic from "next/dynamic";

const SiteSearchPreloader = dynamic(
  () => import("@/components/Common/SiteSearchPreloader"),
  { ssr: false }
);
import { setSearchProgress, startSearchProgress } from "@/lib/shop/searchProgress";
import { chromeBgStyle, type SiteChromeColors } from "@/lib/marketing/chromeColors";
import { SHOP_QUERY_EVENT, applyShopQuery } from "@/lib/shop/shopQuery";
import { AUTH_CHANGED_EVENT } from "@/lib/auth/clientSession";
import { useSession } from "@/hooks/useSession";

export type SiteHeaderData = {
  headerLogo?: string | null;
};

const DEFAULT_HEADER_LOGO = "/images/logo/logo.png";

/** Static files in /public — skip `next/image` optimizer (same as favicon; avoids 404/broken on some hosts). */
function isLocalPublicImage(src: string) {
  return src.startsWith("/images/");
}

export type UtilityAnnouncement = {
  body: string;
  linkUrl?: string | null;
  /** Reserved for future (e.g. aria-label); primary tap target is the full `body` when `linkUrl` is set. */
  linkLabel?: string | null;
};

export type MarqueeAnnouncement = {
  body: string;
  linkUrl?: string | null;
};

type IProps = {
  headerData?: SiteHeaderData | null;
  utilityAnnouncement?: UtilityAnnouncement | null;
  marqueeAnnouncements?: MarqueeAnnouncement[];
  headerNav: HeaderNavData;
  /** Minimum cart subtotal for free shipping; null = feature disabled. */
  freeShippingThresholdInr?: number | null;
  chromeColors?: SiteChromeColors;
};

const MainHeader = ({
  headerData,
  utilityAnnouncement,
  marqueeAnnouncements,
  headerNav,
  freeShippingThresholdInr = null,
  chromeColors,
}: IProps) => {
  const utilityBarStyle = chromeBgStyle(chromeColors?.utilityBarBg);
  const marqueeBarStyle = chromeBgStyle(chromeColors?.marqueeBarBg);
  const headerLogoSrc = headerData?.headerLogo || DEFAULT_HEADER_LOGO;
  const menuData = useMemo(() => buildHeaderMenuData(headerNav), [headerNav]);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputDesktopRef = useRef<HTMLInputElement>(null);
  const searchInputMobileRef = useRef<HTMLInputElement>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [stickyMenu, setStickyMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const [searchPreloaderOpen, setSearchPreloaderOpen] = useState(false);
  const { displayName: userName } = useSession();
  const [accountOpen, setAccountOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const { handleCartClick, cartCount } = useCart();
  const wishlistCount = useAppSelector((state) => state.wishlistReducer).items
    ?.length;

  const handleOpenCartModal = () => {
    handleCartClick();
  };

  const handleStickyMenu = useCallback(
    throttle(() => {
      const next = window.scrollY >= 80;
      startTransition(() => {
        setStickyMenu((prev) => (prev === next ? prev : next));
      });
    }, 100),
    []
  );

  useEffect(() => {
    window.addEventListener("scroll", handleStickyMenu, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleStickyMenu);
    };
  }, [handleStickyMenu]);

  // Close mobile menu when screen size changes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setNavigationOpen(false);
      }
      setIsDesktop(window.innerWidth >= 1280);
    };

    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const close = () => setAccountOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // Keep header search in sync with /shop?q=… (client URL updates + back/forward)
  useEffect(() => {
    if (!pathname.startsWith("/shop")) return;

    const syncFromUrl = () => {
      const q = new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
      setSearchQuery((prev) => (prev === q ? prev : q));
    };

    syncFromUrl();
    const q = searchParams.get("q")?.trim() ?? "";
    setSearchQuery((prev) => (prev === q ? prev : q));

    window.addEventListener(SHOP_QUERY_EVENT, syncFromUrl);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener(SHOP_QUERY_EVENT, syncFromUrl);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, [pathname, searchParams]);

  // Live search on shop — debounced URL updates (no full page navigation)
  useEffect(() => {
    if (!pathname.startsWith("/shop")) return;
    const q = debouncedSearchQuery.trim();
    const usp = new URLSearchParams(window.location.search);
    const current = usp.get("q")?.trim() ?? "";
    if (q === current) return;
    if (q) usp.set("q", q);
    else usp.delete("q");
    usp.delete("page");
    applyShopQuery(pathname, usp.toString());
  }, [debouncedSearchQuery, pathname]);

  useEffect(() => {
    if (!searchPreloaderOpen) return;
    if (pathname.startsWith("/shop")) {
      setSearchProgress(38);
    }
  }, [pathname, searchPreloaderOpen]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    setNavigationOpen(false);
    startSearchProgress();
    setSearchPreloaderOpen(true);
    if (pathname.startsWith("/shop")) {
      const usp = new URLSearchParams(window.location.search);
      if (q) usp.set("q", q);
      else usp.delete("q");
      usp.delete("page");
      applyShopQuery(pathname, usp.toString());
      return;
    }
    if (q.length > 0) {
      router.push(`/shop?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/shop");
    }
  }

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to log out");
      setAccountOpen(false);
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      toast.success("Signed out");
    } catch (err: any) {
      toast.error(err?.message || "Could not log out");
    }
  }

  return (
    <>
      <header
        className={`fixed left-0 top-0 z-50 w-full min-h-14 bg-white transition-all ease-in-out duration-300 sm:min-h-16 ${stickyMenu && "shadow-sm"
          }`}
      >
        {/* Announcement bar */}
        <div
          className={`py-2.5 min-h-[2.75rem] border-b border-white/[0.08] ${utilityBarStyle ? "" : "bg-[#0c1220]"}`}
          style={utilityBarStyle}
          suppressHydrationWarning
        >
          <div className="px-4 mx-auto max-w-7xl sm:px-6 xl:px-0" suppressHydrationWarning>
            <div className="flex items-center justify-between gap-3" suppressHydrationWarning>
              <p className="text-xs sm:text-sm font-medium text-white">
                {utilityAnnouncement?.body ? (
                  utilityAnnouncement.linkUrl ? (
                    <Link
                      href={utilityAnnouncement.linkUrl}
                      prefetch={shouldPrefetchHref(utilityAnnouncement.linkUrl)}
                      className="text-white underline-offset-2 hover:underline"
                      {...(utilityAnnouncement.linkLabel
                        ? { "aria-label": utilityAnnouncement.linkLabel }
                        : {})}
                    >
                      {utilityAnnouncement.body}
                    </Link>
                  ) : (
                    utilityAnnouncement.body
                  )
                ) : freeShippingThresholdInr != null ? (
                  <>
                    Minimum order value for free shipping:{" "}
                    <span className="font-semibold">
                      ₹{freeShippingThresholdInr.toLocaleString("en-IN")}
                    </span>
                  </>
                ) : null}
              </p>
              <div className="flex min-w-[80px] shrink-0 items-center justify-end text-right" suppressHydrationWarning>
                {userName ? (
                  <span className="text-xs sm:text-sm font-medium text-white">
                    Welcome, {userName}!
                  </span>
                ) : (
                  <Link
                    href="/login"
                    prefetch={false}
                    className="text-xs sm:text-sm font-semibold text-[#ff3d3d] hover:text-[#ff6b6b] hover:underline"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Running promo banner — min height avoids CLS when DB-driven copy length changes */}
        <div
          className={`flex min-h-[2.75rem] flex-col justify-center overflow-hidden border-b border-blue-dark ${marqueeBarStyle ? "" : "bg-blue"}`}
          style={marqueeBarStyle}
          suppressHydrationWarning
        >
          <div className="relative" suppressHydrationWarning>
            {(() => {
              const items =
                marqueeAnnouncements && marqueeAnnouncements.length > 0
                  ? marqueeAnnouncements
                  : [
                      { body: "Use code WELCOME10 for 10% off", linkUrl: null as string | null },
                      ...(freeShippingThresholdInr != null
                        ? [
                            {
                              body: `Free shipping over ₹${freeShippingThresholdInr.toLocaleString("en-IN")}`,
                              linkUrl: null as string | null,
                            },
                          ]
                        : []),
                      { body: "New arrivals added weekly", linkUrl: null },
                    ];
              return (
                <div className="marquee-track py-2 text-xs sm:text-sm font-medium text-white" suppressHydrationWarning>
                  {[0, 1].map((copyIdx) => (
                    <div key={copyIdx} className="marquee-group" suppressHydrationWarning>
                      {items.map((item, idx) => (
                        <span key={`${copyIdx}-${idx}`} className="mx-6">
                          {item.linkUrl ? (
                            <Link
                              href={item.linkUrl}
                              prefetch={shouldPrefetchHref(item.linkUrl)}
                              className="text-white underline-offset-2 hover:underline hover:text-white"
                            >
                              {item.body}
                            </Link>
                          ) : (
                            item.body
                          )}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Main Header */}
        <div className="px-4 mx-auto max-w-7xl sm:px-6 xl:px-0" suppressHydrationWarning>
          <div className="relative flex min-h-16 items-center justify-between py-2 xl:py-2" suppressHydrationWarning>
            {/* Left: mobile menu + search | desktop logo + nav */}
            <div className="z-10 flex min-w-[5rem] shrink-0 items-center gap-2 xl:min-w-0 xl:gap-8" suppressHydrationWarning>
              <div className="flex items-center gap-2 xl:hidden" suppressHydrationWarning>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center transition hover:text-blue focus:outline-none"
                  onClick={() => setNavigationOpen(!navigationOpen)}
                  aria-label={navigationOpen ? "Close menu" : "Open menu"}
                >
                  {navigationOpen ? <CloseIcon /> : <MenuIcon />}
                </button>
              </div>
              <div className="hidden items-center gap-8 xl:flex" suppressHydrationWarning>
                <Link className="block shrink-0" href="/">
                  <Image
                    src={headerLogoSrc}
                    alt="Site logo"
                    width={88}
                    height={88}
                    quality={90}
                    unoptimized={isLocalPublicImage(headerLogoSrc) || headerLogoSrc.endsWith(".svg")}
                    className="h-10 w-auto max-h-10 object-contain xl:h-11 xl:max-h-11"
                    loading="eager"
                    fetchPriority="low"
                    sizes="88px"
                  />
                </Link>
                <DesktopMenu
                  menuData={
                    pathname !== "/"
                      ? [{ title: "Home", path: "/" }, ...menuData]
                      : menuData
                  }
                />
              </div>
            </div>

            {/* Center logo — mobile only */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center xl:hidden" suppressHydrationWarning>
              <Link className="pointer-events-auto block" href="/">
                <Image
                  src={headerLogoSrc}
                  alt="Site logo"
                  width={88}
                  height={88}
                  quality={90}
                  unoptimized={isLocalPublicImage(headerLogoSrc) || headerLogoSrc.endsWith(".svg")}
                  className="h-11 w-auto max-h-11 object-contain sm:h-12 sm:max-h-12"
                  loading="eager"
                  fetchPriority="low"
                  sizes="88px"
                />
              </Link>
            </div>

            {/* Right: desktop search + account + cart | mobile cart + account */}
            <div className="z-10 flex min-w-[5rem] shrink-0 items-center justify-end gap-1 xl:min-w-0 xl:gap-2" suppressHydrationWarning>
              {/* Desktop: input expands to the left of the search icon */}
              <form
                data-shop-search-ui
                onSubmit={handleSearchSubmit}
                className="relative hidden xl:block"
              >
                <input
                  ref={searchInputDesktopRef}
                  type="search"
                  name="q"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products…"
                  autoComplete="off"
                  aria-label="Search products"
                  className="h-9 w-[min(22rem,34vw)] rounded-lg border border-gray-3 bg-white py-2 pl-3 pr-9 text-sm text-dark outline-none focus:border-blue"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-meta-4">
                  <SearchIcon />
                </span>
              </form>

              <button
                type="button"
                className="relative inline-flex h-9 w-9 items-center justify-center text-gray-700 transition hover:text-blue focus:outline-none"
                onClick={handleOpenCartModal}
                aria-label="Cart"
              >
                <CartIcon />
                <span
                  className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-normal text-white"
                  suppressHydrationWarning
                >
                  {cartCount || 0}
                </span>
              </button>

              <Link
                href="/wishlist"
                prefetch={false}
                className="relative inline-flex h-9 w-9 items-center justify-center text-gray-700 transition hover:text-blue focus:outline-none"
                aria-label="Wishlist"
              >
                <HeartIcon />
                <span
                  className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-normal text-white"
                  style={{ visibility: wishlistCount > 0 ? "visible" : "hidden" }}
                  aria-hidden={wishlistCount > 0 ? undefined : true}
                  suppressHydrationWarning
                >
                  {wishlistCount || 0}
                </span>
              </Link>

              <div
                className="relative"
                suppressHydrationWarning
                onMouseEnter={() => {
                  if (isDesktop) setAccountOpen(true);
                }}
                onMouseLeave={() => {
                  if (isDesktop) setAccountOpen(false);
                }}
              >
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center transition hover:text-blue focus:outline-none"
                  aria-label="Account"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDesktop) {
                      setAccountOpen((prev) => !prev);
                    } else if (!userName) {
                      window.location.href = "/login";
                    }
                  }}
                >
                  <UserIcon />
                </button>
                <div
                  className={`absolute right-0 top-full z-20 w-44 rounded-lg border border-gray-3 bg-white p-2 shadow-lg transition ${
                    accountOpen ? "visible opacity-100" : "invisible opacity-0"
                  }`}
                  suppressHydrationWarning
                >
                  <Link
                    href={userName ? "/account" : "/login"}
                    prefetch={false}
                    onClick={() => setAccountOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-dark hover:bg-gray-1 hover:text-blue"
                  >
                    Account
                  </Link>
                  {userName ? (
                    <>
                      <Link
                        href="/wishlist"
                        prefetch={false}
                        onClick={() => setAccountOpen(false)}
                        className="mt-1 flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-dark hover:bg-gray-1 hover:text-blue"
                      >
                        <span>Wishlist</span>
                        {wishlistCount ? (
                          <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {wishlistCount}
                          </span>
                        ) : null}
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-dark hover:bg-gray-1 hover:text-blue"
                      >
                        Log out
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Mobile Menu - Offcanvas */}

      <MobileMenu
        headerLogo={headerData?.headerLogo || null}
        isOpen={navigationOpen}
        onClose={() => setNavigationOpen(false)}
        menuData={
          pathname !== "/"
            ? [{ title: "Home", path: "/" }, ...menuData]
            : menuData
        }
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        searchInputRef={searchInputMobileRef}
      />

      {searchPreloaderOpen ? (
        <SiteSearchPreloader onDone={() => setSearchPreloaderOpen(false)} />
      ) : null}
    </>
  );
};

export default MainHeader;
