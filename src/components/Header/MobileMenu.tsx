"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MenuItem } from "./types";
import { CloseIcon } from "./icons";
import Image from "next/image";

const DEFAULT_HEADER_LOGO = "/images/logo/logo1-removebg-preview.png";

interface MobileMenuProps {
  headerLogo: string | null;
  isOpen: boolean;
  onClose: () => void;
  menuData: MenuItem[];
}

const MobileMenu = ({ isOpen, onClose, menuData, headerLogo }: MobileMenuProps) => {
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
      />

      {/* Offcanvas Menu */}
      <div
        className={`fixed top-0 left-0 h-full w-[300px] max-w-full bg-white z-50 shadow-xl transform transition-transform duration-300 ease-in-out mobile-menu-container ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-3">
            <div>
              <Link className="block shrink-0" href="/">
                <Image
                  src={
                    headerLogo ||
                    DEFAULT_HEADER_LOGO
                  }
                  alt="Site logo"
                  width={128}
                  height={128}
                  priority
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

          {/* Menu Items */}
          <div className="flex-1 py-2 overflow-y-auto">
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
                        <div>
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
                          >
                            <div className="pl-2 bg-gray-50 pb-2">
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
          <div className="p-4 border-t border-gray-3">
            <div className="flex items-center gap-3">
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
