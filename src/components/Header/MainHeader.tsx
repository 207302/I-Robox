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

export type SiteHeaderData = {
  headerLogo?: string | null;
};

const DEFAULT_HEADER_LOGO = "/images/logo/logo1-removebg-preview.png";

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
};

type MeResponse = {
  user: {
    id: string;
    email: string | null;
    phone?: string | null;
    name?: string | null;
    roles: string[];
  } | null;
};

const MainHeader = ({
  headerData,
  utilityAnnouncement,
  marqueeAnnouncements,
  headerNav,
  freeShippingThresholdInr = null,
}: IProps) => {
  const menuData = useMemo(() => buildHeaderMenuData(headerNav), [headerNav]);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputDesktopRef = useRef<HTMLInputElement>(null);
  const searchInputMobileRef = useRef<HTMLInputElement>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [stickyMenu, setStickyMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
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

  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const t = window.setTimeout(() => {
      const el =
        window.innerWidth >= 1280
          ? searchInputDesktopRef.current
          : searchInputMobileRef.current;
      el?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const closeIfOutside = (e: MouseEvent) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (el.closest("[data-shop-search-ui]")) return;
      setSearchOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [searchOpen]);

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

  async function loadMe(signal?: AbortSignal) {
    const res = await fetch("/api/auth/me", { cache: "no-store", signal });
    const data = (await res.json().catch(() => null)) as MeResponse | null;
    const rawName = data?.user?.name?.trim();
    const fromEmail = data?.user?.email?.split("@")[0]?.trim();
    const fromPhone = data?.user?.phone?.trim();
    setUserName(rawName || fromEmail || fromPhone || null);
  }

  // Read current customer session for greeting text.
  // Re-check on route changes and auth-change events (login/logout/verify).
  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        await loadMe(controller.signal);
      } catch {
        setUserName(null);
      }
    };
    run();

    const handleAuthChange = () => {
      void run();
    };
    window.addEventListener("irobox-auth-changed", handleAuthChange);

    return () => {
      controller.abort();
      window.removeEventListener("irobox-auth-changed", handleAuthChange);
    };
  }, [pathname]);

  // Keep header search in sync with /shop?q=…
  useEffect(() => {
    if (!pathname.startsWith("/shop")) return;
    const q = searchParams.get("q")?.trim() ?? "";
    setSearchQuery((prev) => (prev === q ? prev : q));
  }, [pathname, searchParams]);

  // Live search while on the shop page (instant — no debounce)
  useEffect(() => {
    if (!pathname.startsWith("/shop")) return;
    const q = searchQuery.trim();
    const usp = new URLSearchParams(searchParams.toString());
    const current = usp.get("q")?.trim() ?? "";
    if (q === current) return;
    if (q) usp.set("q", q);
    else usp.delete("q");
    usp.delete("page");
    const next = usp.toString();
    startTransition(() => {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    });
  }, [searchQuery, pathname, router, searchParams]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    setSearchOpen(false);
    setNavigationOpen(false);
    if (q.length > 0) {
      router.push(`/shop?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/shop");
    }
  }

  function toggleSearch() {
    setSearchOpen((o) => !o);
  }

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to log out");
      setUserName(null);
      setAccountOpen(false);
      window.dispatchEvent(new Event("irobox-auth-changed"));
      toast.success("Signed out");
    } catch (err: any) {
      toast.error(err?.message || "Could not log out");
    }
  }

  return (
    <>
      <header
        className={`fixed left-0 top-0 w-full z-50 bg-white transition-all  ease-in-out duration-300 ${stickyMenu && "shadow-sm"
          }`}
      >
        {/* Announcement bar */}
        <div className="bg-[#0c1220] py-2.5 border-b border-white/[0.08]">
          <div className="px-4 mx-auto max-w-7xl sm:px-6 xl:px-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs sm:text-sm font-medium text-white">
                {utilityAnnouncement?.body ? (
                  utilityAnnouncement.linkUrl ? (
                    <Link
                      href={utilityAnnouncement.linkUrl}
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
              <div className="flex min-w-[80px] shrink-0 items-center justify-end text-right">
                {userName ? (
                  <span className="text-xs sm:text-sm font-medium text-white">
                    Welcome, {userName}!
                  </span>
                ) : (
                  <Link
                    href="/login"
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
        <div className="flex min-h-[2.75rem] flex-col justify-center overflow-hidden border-b border-blue-dark bg-blue">
          <div className="relative">
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
                <div className="marquee-track py-2 text-xs sm:text-sm font-medium text-white">
                  {[0, 1].map((copyIdx) => (
                    <div key={copyIdx} className="marquee-group">
                      {items.map((item, idx) => (
                        <span key={`${copyIdx}-${idx}`} className="mx-6">
                          {item.linkUrl ? (
                            <Link
                              href={item.linkUrl}
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
        <div className="px-4 mx-auto max-w-7xl sm:px-6 xl:px-0">
          <div className="relative flex min-h-[52px] items-center justify-between py-2 xl:min-h-0 xl:py-0">
            {/* Left: mobile menu + search | desktop logo + nav */}
            <div className="z-10 flex min-w-[5rem] shrink-0 items-center gap-2 xl:min-w-0 xl:gap-8">
              <div className="flex items-center gap-2 xl:hidden">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center transition hover:text-blue focus:outline-none"
                  onClick={() => setNavigationOpen(!navigationOpen)}
                  aria-label={navigationOpen ? "Close menu" : "Open menu"}
                >
                  {navigationOpen ? <CloseIcon /> : <MenuIcon />}
                </button>
              </div>
              <div className="hidden items-center gap-8 xl:flex">
                <Link className="block shrink-0 py-2" href="/">
                  <Image
                    src={headerData?.headerLogo || DEFAULT_HEADER_LOGO}
                    alt="Site logo"
                    width={160}
                    height={160}
                    className="h-14 w-auto xl:h-16"
                    loading="eager"
                    sizes="160px"
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
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center xl:hidden">
              <Link className="pointer-events-auto block py-1" href="/">
                <Image
                  src={headerData?.headerLogo || DEFAULT_HEADER_LOGO}
                  alt="Site logo"
                  width={160}
                  height={160}
                  className="h-9 w-auto max-h-9 sm:h-10 sm:max-h-10"
                  loading="eager"
                  sizes="(max-width: 1280px) 120px, 160px"
                />
              </Link>
            </div>

            {/* Right: desktop search + account + cart | mobile cart + account */}
            <div className="z-10 flex min-w-[5rem] shrink-0 items-center justify-end gap-1 xl:min-w-0 xl:gap-2">
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
                <span className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-normal text-white">
                  {cartCount || 0}
                </span>
              </button>

              <Link
                href="/wishlist"
                className="relative inline-flex h-9 w-9 items-center justify-center text-gray-700 transition hover:text-blue focus:outline-none"
                aria-label="Wishlist"
              >
                <HeartIcon />
                {wishlistCount ? (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-normal text-white">
                    {wishlistCount}
                  </span>
                ) : null}
              </Link>

              <div
                className="relative"
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
                >
                  <Link
                    href={userName ? "/account" : "/login"}
                    onClick={() => setAccountOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-dark hover:bg-gray-1 hover:text-blue"
                  >
                    Account
                  </Link>
                  {userName ? (
                    <>
                      <Link
                        href="/wishlist"
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

          {/* Mobile: search always visible below the header row */}
          <form
            data-shop-search-ui
            onSubmit={handleSearchSubmit}
            className="relative mx-auto max-w-7xl border-t border-gray-3 px-4 py-2 sm:px-6 xl:hidden"
          >
            <input
              ref={searchInputMobileRef}
              type="search"
              name="q"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products…"
              autoComplete="off"
              aria-label="Search products"
              className="min-h-[40px] w-full rounded-lg border border-gray-3 bg-white py-2 pl-3 pr-9 text-sm text-dark outline-none focus:border-blue"
            />
            <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-meta-4 sm:right-9">
              <SearchIcon />
            </span>
          </form>
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
      />
    </>
  );
};

export default MainHeader;
