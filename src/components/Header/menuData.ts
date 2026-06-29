import type { HeaderNavData } from "@/lib/nav/headerNav";
import type { MenuItem } from "./types";

function shopBrandPath(slug: string) {
  return `/brand/${encodeURIComponent(slug)}`;
}

function shopCategoryPath(slug: string) {
  return `/category/${encodeURIComponent(slug)}`;
}

/** Build primary nav: Categories = all categories, Brands = all brands. */
export function buildHeaderMenuData(nav: HeaderNavData): MenuItem[] {
  const categoryItems: MenuItem[] = nav.categories.map((c) => ({
    title: c.name,
    path: shopCategoryPath(c.slug),
  }));

  const categoriesMenu: MenuItem =
    categoryItems.length > 0
      ? { title: "Categories", submenu: categoryItems }
      : {
          title: "Categories",
          submenu: [{ title: "Browse shop", path: "/shop" }],
        };

  const brandItems: MenuItem[] = nav.brands.map((b) => ({
    title: b.name,
    path: shopBrandPath(b.slug),
  }));

  const brandsMenu: MenuItem =
    brandItems.length > 0
      ? { title: "Brands", submenu: brandItems }
      : {
          title: "Brands",
          submenu: [{ title: "Browse shop", path: "/shop" }],
        };

  return [
    { title: "Shop", path: "/shop" },
    categoriesMenu,
    brandsMenu,
    { title: "Contact", path: "/contact" },
  ];
}
