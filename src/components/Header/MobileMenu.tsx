"use client";

import { useEffect, useState, type FormEvent, type RefObject } from "react";
import Link from "next/link";
import type { MenuItem } from "./types";
import { CloseIcon, SearchIcon } from "./icons";
import Image from "next/image";

const DEFAULT_HEADER_LOGO = "/images/logo/logo1-removebg-preview.png";

interface MobileMenuProps {
  headerLogo: string | null;
  isOpen: boolean;
  onClose: () => void;
  menuData: MenuItem[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: (e: FormEvent) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

const MobileMenu = ({
  isOpen,
  onClose,
  menuData,
  headerLogo,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  searchInputRef,
}: MobileMenuProps) => {
  const [expandedItems, setExpandedItems] = useState<number[]>([]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        isOpen &&
        !target.closest(".mobile-menu-container") &&
        !target.closest("#Toggle")
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => searchInputRef?.current?.focus(), 150);
    return () => window.clearTimeout(t);
  }, [isOpen, searchInputRef]);

  const toggleSubmenu = (index: number) => {
    setExpandedItems((prev) =>
      prev.includes(index)
        ? prev.filter((item) => item !== index)
        : [...prev, index]
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-dark/50 z-50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        suppressHydrationWarning
      />

      {/* Offcanvas Menu */}
      <div
        className={`mobile-menu-container fixed top-0 left-0 z-50 h-full w-[min(300px,100vw)] max-w-full overflow-hidden bg-white shadow-xl transition-[transform,visibility] duration-300 ease-in-out ${
          isOpen ? "visible translate-x-0" : "invisible pointer-events-none -translate-x-full"
        }`}
        aria-hidden={!isOpen}
        suppressHydrationWarning
      >
        <div className="flex h-full min-w-0 flex-col overflow-hidden" suppressHydrationWarning>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-3" suppressHydrationWarning>
            <div suppressHydrationWarning>
              <Link className="block shrink-0" href="/">
                <Image
                  src={
                    headerLogo ||
                    DEFAULT_HEADER_LOGO
                  }
                  alt="Site logo"
                  width={100}
                  height={100}
                  className="h-10 w-auto max-h-10 object-contain"
                  sizes="100px"
                  loading="lazy"
                />
              </Link>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
          </div>

          <form
            data-shop-search-ui
            onSubmit={onSearchSubmit}
            className="box-border w-full min-w-0 shrink-0 border-b border-gray-3 px-4 py-3"
          >
            <div className="flex h-10 w-full max-w-full items-center overflow-hidden rounded-lg border border-gray-3 bg-white focus-within:border-blue">
              <input
                ref={searchInputRef}
                type="text"
                name="q"
                role="searchbox"
                inputMode="search"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search products…"
                autoComplete="off"
                enterKeyHint="search"
                aria-label="Search products"
                className="min-w-0 flex-1 border-0 bg-transparent py-2 pl-3 pr-1 text-sm text-dark outline-none"
              />
              <button
                type="submit"
                className="mr-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-meta-4 transition hover:text-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                aria-label="Search"
              >
                <SearchIcon className="h-5 w-5 shrink-0" />
              </button>
            </div>
          </form>

          {/* Menu Items */}
          <div className="flex-1 py-2 overflow-y-auto" suppressHydrationWarning>
            <nav>
              <ul className="px-2">
                {menuData.map((menuItem, i) => {
                  const hasFlat = Boolean(menuItem.submenu?.length);
                  const hasGrouped = Boolean(menuItem.groupedSubmenu?.length);
                  const isDropdown = hasFlat || hasGrouped;
                  const expandedMax =
                    hasGrouped && expandedItems.includes(i)
                      ? "max-h-[min(75vh,640px)]"
                      : "max-h-96";

                  return (
                    <li key={menuItem.title} className="">
                      {isDropdown ? (
                        <div suppressHydrationWarning>
                          <button
                            type="button"
                            onClick={() => toggleSubmenu(i)}
                            className="flex items-center justify-between w-full px-4 py-3 text-sm rounded-lg text-dark hover:text-blue hover:bg-gray-2"
                          >
                            <span className="font-medium">{menuItem.title}</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`transition-transform duration-200 ${
                                expandedItems.includes(i) ? "rotate-180" : ""
                              }`}
                            >
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>

                          <div
                            className={`overflow-y-auto overflow-x-hidden transition-all duration-300 ${
                              expandedItems.includes(i) ? expandedMax : "max-h-0"
                            }`}
                            suppressHydrationWarning
                          >
                            <div className="pl-2 bg-gray-50 pb-2" suppressHydrationWarning>
                              {menuItem.submenu?.map((subItem, j) => (
                                <Link
                                  key={subItem.path ?? subItem.title}
                                  href={subItem.path || "#"}
                                  className="block px-4 py-3 text-sm rounded-lg hover:bg-gray-2 text-dark border-gray-3 hover:text-blue "
                                  onClick={onClose}
                                >
                                  {subItem.title}
                                </Link>
                              ))}
                              {menuItem.groupedSubmenu?.map((group, gi) => (
                                <div
                                  key={group.heading}
                                  className={gi > 0 ? "mt-2 pt-2 border-t border-gray-3" : ""}
                                >
                                  <p className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-dark">
                                    {group.heading}
                                  </p>
                                  {group.items.map((subItem, j) => (
                                    <Link
                                      key={subItem.path ?? subItem.title}
                                      href={subItem.path || "#"}
                                      className="block px-4 py-2.5 text-sm rounded-lg hover:bg-gray-2 text-dark hover:text-blue"
                                      onClick={onClose}
                                    >
                                      {subItem.title}
                                    </Link>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Link
                          href={menuItem.path || "#"}
                          className="block px-4 py-3 text-sm font-medium rounded-lg hover:text-blue text-dark hover:bg-gray-2"
                          onClick={onClose}
                        >
                          {menuItem.title}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-3" suppressHydrationWarning>
            <div className="flex items-center gap-3" suppressHydrationWarning>
              <Link
                href="/login"
                className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                onClick={onClose}
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
