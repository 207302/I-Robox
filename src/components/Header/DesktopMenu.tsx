"use client";

import Link from "next/link";
import { useState } from "react";
import type { MenuItem } from "./types";
import { usePathname } from "next/navigation";

interface DesktopMenuProps {
  menuData: MenuItem[];
}

function pathBaseActive(pathname: string, itemPath?: string) {
  if (!itemPath) return false;
  return pathname.split("?")[0] === itemPath.split("?")[0];
}

const DesktopMenu = ({ menuData }: DesktopMenuProps) => {
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const pathname = usePathname();

  const handleMouseEnter = (index: number) => {
    setActiveDropdown(index);
  };

  const handleMouseLeave = () => {
    setActiveDropdown(null);
  };

  return (
    <nav>
      <ul className="flex items-center gap-6">
        {menuData.map((menuItem, i) => {
          const hasFlat = Boolean(menuItem.submenu?.length);
          const hasGrouped = Boolean(menuItem.groupedSubmenu?.length);
          const flatCount = menuItem.submenu?.length ?? 0;
          const scrollLongFlat = hasFlat && flatCount > 12;
          const isDropdown = hasFlat || hasGrouped;

          return (
            <li
              key={menuItem.title}
              className="relative group"
              onMouseEnter={() => handleMouseEnter(i)}
              onMouseLeave={handleMouseLeave}
            >
              {isDropdown ? (
                <>
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-blue font-medium py-4 relative text-sm text-dark"
                  >
                    {menuItem.title}
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
                      className={`transition-transform duration-200 ${activeDropdown === i ? "rotate-180" : ""
                        }`}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>

                  <div
                    className={`absolute left-0 border border-gray-2 top-full bg-white shadow-lg rounded-lg p-2 z-50 transform transition-all duration-200 ${hasGrouped || scrollLongFlat ? "min-w-[260px] max-w-sm max-h-[min(70vh,520px)] overflow-y-auto" : "min-w-[220px]"
                      } ${activeDropdown === i
                        ? "opacity-100 translate-y-0 visible"
                        : "opacity-0 translate-y-2 invisible"
                      }`}
                    suppressHydrationWarning
                  >
                    {menuItem.submenu?.map((subItem, j) => (
                      <Link
                        key={subItem.path ?? subItem.title}
                        href={subItem.path || "#"}
                        className={`block px-4 py-2 text-sm font-medium rounded-lg hover:text-blue hover:bg-gray-2 ${pathBaseActive(pathname, subItem.path) ? "text-blue" : "text-dark"}`}
                      >
                        {subItem.title}
                      </Link>
                    ))}
                    {menuItem.groupedSubmenu?.map((group, gi) => (
                      <div
                        key={group.heading}
                        className={gi > 0 ? "mt-3 pt-3 border-t border-gray-2" : ""}
                      >
                        <p className="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-dark">
                          {group.heading}
                        </p>
                        {group.items.map((subItem, j) => (
                          <Link
                            key={subItem.path ?? subItem.title}
                            href={subItem.path || "#"}
                            className={`block px-4 py-2 text-sm font-medium rounded-lg hover:text-blue hover:bg-gray-2 ${pathBaseActive(pathname, subItem.path) ? "text-blue" : "text-dark"}`}
                          >
                            {subItem.title}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Link
                  href={menuItem.path || "#"}
                  className={`hover:text-blue font-medium py-4 block relative text-sm ${menuItem.path && pathBaseActive(pathname, menuItem.path) ? "text-blue" : "text-dark"}`}
                >
                  {menuItem.title}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default DesktopMenu;
