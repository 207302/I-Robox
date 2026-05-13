"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import QuickLinkHtmlEditor from "@/components/admin/QuickLinkHtmlEditor";

type SiteSettingsRow = {
  id?: string;
  first_visit_coupon_code?: string | null;
  hero_overlay_eyebrow?: string | null;
  hero_overlay_heading?: string | null;
  hero_overlay_subheading?: string | null;
  hero_overlay_cta_label?: string | null;
  hero_overlay_cta_href?: string | null;
  highlights_section_eyebrow?: string | null;
  highlights_section_heading?: string | null;
  privacy_page_title?: string | null;
  privacy_page_subtitle?: string | null;
  privacy_page_content?: string | null;
  terms_page_title?: string | null;
  terms_page_subtitle?: string | null;
  terms_page_content?: string | null;
  returns_page_title?: string | null;
  returns_page_subtitle?: string | null;
  returns_page_content?: string | null;
  faq_page_title?: string | null;
  faq_page_subtitle?: string | null;
  faq_page_content?: string | null;
  contact_page_title?: string | null;
  contact_page_subtitle?: string | null;
  contact_page_content?: string | null;
  help_support_title?: string | null;
  contact_address?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  social_facebook_url?: string | null;
  social_twitter_url?: string | null;
  social_instagram_url?: string | null;
  social_linkedin_url?: string | null;
};

type QuickLinkPageAdminKey = "privacy" | "terms" | "returns" | "faq" | "contact";

type Initial = {
  slides: unknown[];
  highlights: unknown[];
  brandRail: unknown[];
  categoryTiles: unknown[];
  announcements: unknown[];
  popups: unknown[];
  flashSales: unknown[];
  settings: SiteSettingsRow | null;
  categories: { id: string; name: string; slug: string }[];
  products: {
    id: string;
    name: string;
    slug: string;
    base_price: number | string;
    discounted_price: number | string | null;
  }[];
  brands: { id: string; name: string; slug: string }[];
  coupons: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    is_active: boolean;
  }[];
};

async function j<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

export default function MarketingAdminClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [tab, setTab] = useState<
    | "hero"
    | "highlights"
    | "brandRail"
    | "categoryGrid"
    | "announcements"
    | "popups"
    | "flash"
    | "settings"
  >("hero");
  const [slides, setSlides] = useState(initial.slides);
  const [highlights, setHighlights] = useState(initial.highlights);
  const [brandRailRows, setBrandRailRows] = useState(initial.brandRail);
  const [categoryGridRows, setCategoryGridRows] = useState(initial.categoryTiles);
  const [announcements, setAnnouncements] = useState(initial.announcements);
  const [popups, setPopups] = useState(initial.popups);
  const [flashSales, setFlashSales] = useState(initial.flashSales);
  const [firstVisit, setFirstVisit] = useState(initial.settings?.first_visit_coupon_code ?? "");
  const st0 = initial.settings;
  const [helpSupportTitle, setHelpSupportTitle] = useState(st0?.help_support_title ?? "");
  const [contactAddress, setContactAddress] = useState(st0?.contact_address ?? "");
  const [contactPhone, setContactPhone] = useState(st0?.contact_phone ?? "");
  const [contactEmail, setContactEmail] = useState(st0?.contact_email ?? "");
  const [socialFacebook, setSocialFacebook] = useState(st0?.social_facebook_url ?? "");
  const [socialTwitter, setSocialTwitter] = useState(st0?.social_twitter_url ?? "");
  const [socialInstagram, setSocialInstagram] = useState(st0?.social_instagram_url ?? "");
  const [socialLinkedIn, setSocialLinkedIn] = useState(st0?.social_linkedin_url ?? "");
  const [heroOverlayEyebrow, setHeroOverlayEyebrow] = useState(st0?.hero_overlay_eyebrow ?? "");
  const [heroOverlayHeading, setHeroOverlayHeading] = useState(st0?.hero_overlay_heading ?? "");
  const [heroOverlaySubheading, setHeroOverlaySubheading] = useState(st0?.hero_overlay_subheading ?? "");
  const [heroOverlayCtaLabel, setHeroOverlayCtaLabel] = useState(st0?.hero_overlay_cta_label ?? "");
  const [heroOverlayCtaHref, setHeroOverlayCtaHref] = useState(st0?.hero_overlay_cta_href ?? "");
  const [quickLinkPages, setQuickLinkPages] = useState<
    Record<QuickLinkPageAdminKey, { title: string; subtitle: string; content: string }>
  >({
    privacy: {
      title: st0?.privacy_page_title ?? "",
      subtitle: st0?.privacy_page_subtitle ?? "",
      content: st0?.privacy_page_content ?? "",
    },
    terms: {
      title: st0?.terms_page_title ?? "",
      subtitle: st0?.terms_page_subtitle ?? "",
      content: st0?.terms_page_content ?? "",
    },
    returns: {
      title: st0?.returns_page_title ?? "",
      subtitle: st0?.returns_page_subtitle ?? "",
      content: st0?.returns_page_content ?? "",
    },
    faq: {
      title: st0?.faq_page_title ?? "",
      subtitle: st0?.faq_page_subtitle ?? "",
      content: st0?.faq_page_content ?? "",
    },
    contact: {
      title: st0?.contact_page_title ?? "",
      subtitle: st0?.contact_page_subtitle ?? "",
      content: st0?.contact_page_content ?? "",
    },
  });
  const [quickLinkPageKey, setQuickLinkPageKey] = useState<QuickLinkPageAdminKey>("privacy");
  const [quickLinkTitle, setQuickLinkTitle] = useState(st0?.privacy_page_title ?? "");
  const [quickLinkSubtitle, setQuickLinkSubtitle] = useState(st0?.privacy_page_subtitle ?? "");
  const [quickLinkContent, setQuickLinkContent] = useState(st0?.privacy_page_content ?? "");
  const [highlightsEyebrow, setHighlightsEyebrow] = useState(st0?.highlights_section_eyebrow ?? "");
  const [highlightsHeading, setHighlightsHeading] = useState(st0?.highlights_section_heading ?? "");
  const [storefrontSaving, setStorefrontSaving] = useState(false);
  const [quickLinkSaving, setQuickLinkSaving] = useState(false);
  const [heroOverlaySaving, setHeroOverlaySaving] = useState(false);
  const [highlightsSectionSaving, setHighlightsSectionSaving] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [highlightUploading, setHighlightUploading] = useState(false);
  const [brandRailUploading, setBrandRailUploading] = useState(false);
  const [categoryGridUploading, setCategoryGridUploading] = useState(false);
  const [popupUploading, setPopupUploading] = useState(false);
  const [flashSaving, setFlashSaving] = useState(false);
  const [flashEditingId, setFlashEditingId] = useState<string | null>(null);
  const [flashEditPrice, setFlashEditPrice] = useState<string>("");
  const [flashEditActive, setFlashEditActive] = useState<boolean>(true);

  const cats = initial.categories;
  const prods = initial.products;
  const brands = initial.brands;
  const coupons = initial.coupons;
  const quickLinkFieldMap: Record<
    QuickLinkPageAdminKey,
    { title: keyof SiteSettingsRow; subtitle: keyof SiteSettingsRow; content: keyof SiteSettingsRow; label: string }
  > = {
    privacy: {
      title: "privacy_page_title",
      subtitle: "privacy_page_subtitle",
      content: "privacy_page_content",
      label: "Privacy Policy",
    },
    terms: {
      title: "terms_page_title",
      subtitle: "terms_page_subtitle",
      content: "terms_page_content",
      label: "Terms & Conditions",
    },
    returns: {
      title: "returns_page_title",
      subtitle: "returns_page_subtitle",
      content: "returns_page_content",
      label: "Return & Cancellation",
    },
    faq: {
      title: "faq_page_title",
      subtitle: "faq_page_subtitle",
      content: "faq_page_content",
      label: "FAQ",
    },
    contact: {
      title: "contact_page_title",
      subtitle: "contact_page_subtitle",
      content: "contact_page_content",
      label: "Contact",
    },
  };

  const productOptions = useMemo(
    () =>
      prods.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} (listed: ₹{Number(p.discounted_price ?? p.base_price)})
        </option>
      )),
    [prods]
  );
  const categoryOptions = useMemo(
    () =>
      cats.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      )),
    [cats]
  );
  const brandOptions = useMemo(
    () =>
      brands.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      )),
    [brands]
  );
  const usedCategoryIdsForGrid = useMemo(
    () =>
      new Set(
        (categoryGridRows as { category_id: string }[]).map((r) => r.category_id)
      ),
    [categoryGridRows]
  );
  const categoryOptionsForGrid = useMemo(
    () =>
      cats
        .filter((c) => !usedCategoryIdsForGrid.has(c.id))
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        )),
    [cats, usedCategoryIdsForGrid]
  );
  const couponOptions = useMemo(
    () =>
      coupons
        .filter((c) => c.is_active)
        .map((c) => (
          <option key={c.id} value={c.code}>
            {c.code} ({c.discount_type === "PERCENTAGE" ? `${c.discount_value}%` : `₹${c.discount_value}`})
          </option>
        )),
    [coupons]
  );

  async function refreshHero() {
    const r = await fetch("/api/admin/marketing/hero-slides", { cache: "no-store" });
    setSlides(await r.json());
  }
  async function refreshHighlights() {
    const r = await fetch("/api/admin/marketing/highlights", { cache: "no-store" });
    setHighlights(await r.json());
  }
  async function refreshBrandRail() {
    const r = await fetch("/api/admin/marketing/brand-rail", { cache: "no-store" });
    setBrandRailRows(await r.json());
  }
  async function refreshCategoryGrid() {
    const r = await fetch("/api/admin/marketing/category-tiles", { cache: "no-store" });
    setCategoryGridRows(await r.json());
  }
  async function refreshAnnouncements() {
    const r = await fetch("/api/admin/marketing/announcements", { cache: "no-store" });
    setAnnouncements(await r.json());
  }
  async function refreshPopups() {
    const r = await fetch("/api/admin/marketing/popups", { cache: "no-store" });
    setPopups(await r.json());
  }
  async function refreshFlash() {
    const r = await fetch(`/api/admin/marketing/flash-sales?t=${Date.now()}`, { cache: "no-store" });
    setFlashSales(await r.json());
  }

  function listedPriceForProduct(productId: string): number | null {
    const p = prods.find((x) => x.id === productId);
    if (!p) return null;
    return Number(p.discounted_price ?? p.base_price);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">Marketing</h1>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["hero", "Hero"],
            ["highlights", "Highlights"],
            ["brandRail", "Shop by brand"],
            ["categoryGrid", "Discover by category"],
            ["announcements", "Announcements"],
            ["popups", "Popups"],
            ["flash", "Flash sales"],
            ["settings", "First visit"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${
              tab === k
                ? "border-blue bg-blue text-white"
                : "border-gray-3 bg-white text-dark hover:bg-gray-1"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "hero" ? (
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Hero slides</h2>
          <div className="rounded-xl border border-gray-3 bg-gray-1/40 p-4 space-y-3 max-w-2xl">
            <h3 className="text-sm font-semibold text-dark">Hero overlay text (homepage)</h3>
            <p className="text-xs text-meta-3">
              This text stays over the moving hero images. Leave a field empty and save to use default text.
            </p>
            <label className="block">
              <span className="text-sm font-medium">Eyebrow</span>
              <input
                value={heroOverlayEyebrow}
                onChange={(e) => setHeroOverlayEyebrow(e.target.value)}
                placeholder="Tron Play World"
                className="mt-1 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Main heading</span>
              <input
                value={heroOverlayHeading}
                onChange={(e) => setHeroOverlayHeading(e.target.value)}
                placeholder="India's Ultimate Toy & RC Destination"
                className="mt-1 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Subheading</span>
              <textarea
                value={heroOverlaySubheading}
                onChange={(e) => setHeroOverlaySubheading(e.target.value)}
                rows={3}
                placeholder="RC cars, anime figures, diecast models, board games, and more."
                className="mt-1 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">CTA label</span>
                <input
                  value={heroOverlayCtaLabel}
                  onChange={(e) => setHeroOverlayCtaLabel(e.target.value)}
                  placeholder="Shop Now"
                  className="mt-1 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">CTA link</span>
                <input
                  value={heroOverlayCtaHref}
                  onChange={(e) => setHeroOverlayCtaHref(e.target.value)}
                  placeholder="/shop"
                  className="mt-1 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={heroOverlaySaving}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={async () => {
                try {
                  setHeroOverlaySaving(true);
                  const row = await j<SiteSettingsRow>(
                    await fetch("/api/admin/marketing/settings", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        hero_overlay_eyebrow: heroOverlayEyebrow.trim() || null,
                        hero_overlay_heading: heroOverlayHeading.trim() || null,
                        hero_overlay_subheading: heroOverlaySubheading.trim() || null,
                        hero_overlay_cta_label: heroOverlayCtaLabel.trim() || null,
                        hero_overlay_cta_href: heroOverlayCtaHref.trim() || null,
                      }),
                    })
                  );
                  setHeroOverlayEyebrow(row.hero_overlay_eyebrow ?? "");
                  setHeroOverlayHeading(row.hero_overlay_heading ?? "");
                  setHeroOverlaySubheading(row.hero_overlay_subheading ?? "");
                  setHeroOverlayCtaLabel(row.hero_overlay_cta_label ?? "");
                  setHeroOverlayCtaHref(row.hero_overlay_cta_href ?? "");
                  toast.success("Hero overlay text saved");
                  router.refresh();
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                } finally {
                  setHeroOverlaySaving(false);
                }
              }}
            >
              {heroOverlaySaving ? "Saving…" : "Save hero overlay"}
            </button>
          </div>
          <ul className="divide-y divide-gray-3 text-sm">
            {slides.map((row: any) => (
              <li key={row.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-meta-3 font-mono text-xs">{row.id}</span>
                <span className="flex-1 truncate">{row.image_url}</span>
                <button
                  type="button"
                  className="text-red-600 text-sm"
                  onClick={async () => {
                    if (!confirm("Delete slide?")) return;
                    await j(
                      await fetch(`/api/admin/marketing/hero-slides/${row.id}`, { method: "DELETE" })
                    );
                    toast.success("Deleted");
                    void refreshHero();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              try {
                let imageUrl = String(fd.get("image_url") ?? "").trim();
                let imagePublicId: string | null = null;
                const heroFile = fd.get("image_file");
                if (heroFile instanceof File && heroFile.size > 0) {
                  setHeroUploading(true);
                  const uploadFd = new FormData();
                  uploadFd.append("file", heroFile);
                  const uploadRes = await j<{ url: string; public_id: string }>(
                    await fetch("/api/admin/marketing/hero-slides/upload", {
                      method: "POST",
                      body: uploadFd,
                    })
                  );
                  imageUrl = uploadRes.url;
                  imagePublicId = uploadRes.public_id;
                }
                if (!imageUrl) throw new Error("Provide an image URL or upload a banner image");

                await j(
                  await fetch("/api/admin/marketing/hero-slides", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      image_url: imageUrl,
                      image_public_id: imagePublicId,
                      title: fd.get("title") || null,
                      link_url: fd.get("link_url") || null,
                      sort_order: Number(fd.get("sort_order") || 0),
                      is_active: fd.get("is_active") === "on",
                    }),
                  })
                );
                toast.success("Created");
                formEl.reset();
                void refreshHero();
              } catch (err: any) {
                toast.error(err?.message || "Failed");
              } finally {
                setHeroUploading(false);
              }
            }}
          >
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Image URL (optional if uploading)</span>
              <input name="image_url" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Upload Banner (Cloudinary)</span>
              <input
                name="image_file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-meta-3">If both are provided, uploaded file is used.</p>
            </label>
            <label>
              <span className="text-sm font-medium">Title</span>
              <input name="title" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-sm font-medium">Link URL</span>
              <input name="link_url" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-sm font-medium">Sort</span>
              <input name="sort_order" type="number" defaultValue={0} className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input name="is_active" type="checkbox" defaultChecked /> Active
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={heroUploading}
                className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {heroUploading ? "Uploading..." : "Add slide"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === "highlights" ? (
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Homepage highlights</h2>

          <div className="rounded-xl border border-gray-3 bg-gray-1/40 p-4 space-y-3 max-w-2xl">
            <h3 className="text-sm font-semibold text-dark">Section heading (homepage)</h3>
            <p className="text-xs text-meta-3">
              Shown above the highlight cards. Leave a field empty and save to restore the default for that line.
            </p>
            <label className="block">
              <span className="text-sm font-medium">Small label</span>
              <input
                value={highlightsEyebrow}
                onChange={(e) => setHighlightsEyebrow(e.target.value)}
                placeholder="Highlights"
                className="mt-1 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-meta-4">Uses uppercase styling on the storefront.</span>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Main heading</span>
              <input
                value={highlightsHeading}
                onChange={(e) => setHighlightsHeading(e.target.value)}
                placeholder="Featured collections and picks."
                className="mt-1 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={highlightsSectionSaving}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={async () => {
                try {
                  setHighlightsSectionSaving(true);
                  const row = await j<SiteSettingsRow>(
                    await fetch("/api/admin/marketing/settings", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        highlights_section_eyebrow: highlightsEyebrow.trim() || null,
                        highlights_section_heading: highlightsHeading.trim() || null,
                      }),
                    })
                  );
                  setHighlightsEyebrow(row.highlights_section_eyebrow ?? "");
                  setHighlightsHeading(row.highlights_section_heading ?? "");
                  toast.success("Highlights heading saved");
                  router.refresh();
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                } finally {
                  setHighlightsSectionSaving(false);
                }
              }}
            >
              {highlightsSectionSaving ? "Saving…" : "Save heading"}
            </button>
          </div>

          <ul className="divide-y divide-gray-3 text-sm">
            {highlights.map((row: any) => (
              <li key={row.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {row.kind} — {row.title}
                </span>
                <button
                  type="button"
                  className="text-red-600 text-sm"
                  onClick={async () => {
                    if (!confirm("Delete?")) return;
                    await j(await fetch(`/api/admin/marketing/highlights/${row.id}`, { method: "DELETE" }));
                    toast.success("Deleted");
                    void refreshHighlights();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              const kind = String(fd.get("kind"));
              try {
                let imageUrl = String(fd.get("image_url") ?? "").trim();
                let imagePublicId: string | null = null;
                const hiFile = fd.get("image_file");
                if (hiFile instanceof File && hiFile.size > 0) {
                  setHighlightUploading(true);
                  const uploadFd = new FormData();
                  uploadFd.append("file", hiFile);
                  const uploadRes = await j<{ url: string; public_id: string }>(
                    await fetch("/api/admin/marketing/highlights/upload", {
                      method: "POST",
                      body: uploadFd,
                    })
                  );
                  imageUrl = uploadRes.url;
                  imagePublicId = uploadRes.public_id;
                }
                await j(
                  await fetch("/api/admin/marketing/highlights", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      kind,
                      category_id: kind === "CATEGORY" ? fd.get("category_id") : null,
                      product_id: kind === "PRODUCT" ? fd.get("product_id") : null,
                      brand_id: kind === "BRAND" ? fd.get("brand_id") : null,
                      title: fd.get("title"),
                      subtitle: fd.get("subtitle") || null,
                      image_url: imageUrl || null,
                      image_public_id: imagePublicId,
                      link_url: fd.get("link_url") || null,
                      sort_order: Number(fd.get("sort_order") || 0),
                      is_active: fd.get("is_active") === "on",
                    }),
                  })
                );
                toast.success("Created");
                formEl.reset();
                void refreshHighlights();
              } catch (err: any) {
                toast.error(err?.message || "Failed");
              } finally {
                setHighlightUploading(false);
              }
            }}
          >
            <label>
              <span className="text-sm font-medium">Kind</span>
              <select name="kind" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm">
                <option value="FEATURED">FEATURED</option>
                <option value="TRENDING">TRENDING</option>
                <option value="CATEGORY">CATEGORY</option>
                <option value="PRODUCT">PRODUCT</option>
                <option value="BRAND">BRAND</option>
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">Category (for CATEGORY)</span>
              <select name="category_id" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm">
                <option value="">—</option>
                {categoryOptions}
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">Product (for PRODUCT)</span>
              <select name="product_id" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm">
                <option value="">—</option>
                {productOptions}
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">Brand (for BRAND)</span>
              <select name="brand_id" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm">
                <option value="">—</option>
                {brandOptions}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Title</span>
              <input name="title" required className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Subtitle</span>
              <input name="subtitle" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Image URL (optional if uploading)</span>
              <input name="image_url" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Upload Image (Cloudinary)</span>
              <input
                name="image_file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-meta-3">If both are provided, uploaded file is used.</p>
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Link override</span>
              <input name="link_url" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-sm font-medium">Sort</span>
              <input name="sort_order" type="number" defaultValue={0} className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input name="is_active" type="checkbox" defaultChecked /> Active
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={highlightUploading}
                className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {highlightUploading ? "Uploading..." : "Add highlight"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === "brandRail" ? (
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Shop by brand (homepage)</h2>
          <p className="text-sm text-meta-3">
            Square image and label below — same layout as the storefront. Each tile links to that brand in
            the shop. Leave label blank to use the catalog brand name.
          </p>
          <ul className="divide-y divide-gray-3 text-sm">
            {brandRailRows.map((row: any) => (
              <li key={row.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <span className="flex-1 min-w-[200px]">
                  <span className="font-medium text-dark">
                    {row.brands?.name ?? "Brand"}
                  </span>
                  {row.label_override ? (
                    <span className="text-meta-3"> — label: {row.label_override}</span>
                  ) : null}
                  <span className="block truncate text-xs text-meta-4 mt-0.5">{row.image_url}</span>
                </span>
                <button
                  type="button"
                  className="text-red-600 text-sm"
                  onClick={async () => {
                    if (!confirm("Delete this brand tile?")) return;
                    await j(
                      await fetch(`/api/admin/marketing/brand-rail/${row.id}`, { method: "DELETE" })
                    );
                    toast.success("Deleted");
                    void refreshBrandRail();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              try {
                const brandId = String(fd.get("brand_id") ?? "");
                if (!brandId) throw new Error("Choose a brand");

                let imageUrl = String(fd.get("image_url") ?? "").trim();
                let imagePublicId: string | null = null;
                const brFile = fd.get("image_file");
                if (brFile instanceof File && brFile.size > 0) {
                  setBrandRailUploading(true);
                  const uploadFd = new FormData();
                  uploadFd.append("file", brFile);
                  const uploadRes = await j<{ url: string; public_id: string }>(
                    await fetch("/api/admin/marketing/brand-rail/upload", {
                      method: "POST",
                      body: uploadFd,
                    })
                  );
                  imageUrl = uploadRes.url;
                  imagePublicId = uploadRes.public_id;
                }
                if (!imageUrl) throw new Error("Provide an image URL or upload a square image");

                await j(
                  await fetch("/api/admin/marketing/brand-rail", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      brand_id: brandId,
                      image_url: imageUrl,
                      image_public_id: imagePublicId,
                      label_override: String(fd.get("label_override") ?? "").trim() || null,
                      sort_order: Number(fd.get("sort_order") || 0),
                      is_active: fd.get("is_active") === "on",
                    }),
                  })
                );
                toast.success("Created");
                formEl.reset();
                void refreshBrandRail();
                router.refresh();
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed");
              } finally {
                setBrandRailUploading(false);
              }
            }}
          >
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Brand (shop link)</span>
              <select
                name="brand_id"
                required
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              >
                <option value="">— Select —</option>
                {brandOptions}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Label on tile (optional)</span>
              <input
                name="label_override"
                placeholder="Uses catalog brand name if empty"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Image URL (optional if uploading)</span>
              <input name="image_url" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Upload image (Cloudinary)</span>
              <input
                name="image_file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-meta-3">Square photos work best. Max 4 MB on production.</p>
            </label>
            <label>
              <span className="text-sm font-medium">Sort</span>
              <input
                name="sort_order"
                type="number"
                defaultValue={0}
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input name="is_active" type="checkbox" defaultChecked /> Active
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={brandRailUploading}
                className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {brandRailUploading ? "Uploading…" : "Add brand tile"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === "categoryGrid" ? (
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Discover by category (homepage)</h2>
          <p className="text-sm text-meta-3">
            Each row is one tile on the homepage grid. Pick the catalog category, upload a cover image, and
            set sort order. Only active tiles are shown; if this list is empty, the site
            falls back to the first eight categories without photos.
          </p>
          <ul className="divide-y divide-gray-3 text-sm">
            {(categoryGridRows as any[]).map((row) => (
              <li key={row.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0 flex-1">
                  {row.image_url ? (
                    <Image
                      src={row.image_url}
                      alt=""
                      width={64}
                      height={64}
                      unoptimized
                      className="w-16 h-16 rounded-lg object-cover border border-gray-3 shrink-0"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <span className="font-medium text-dark">
                      {row.categories?.name ?? "Category"}
                    </span>
                    {row.label_override ? (
                      <span className="text-meta-3"> — label: {row.label_override}</span>
                    ) : null}
                    <span className="block text-xs text-meta-4 mt-0.5">
                      sort {row.sort_order} · {row.is_active ? "active" : "inactive"}
                    </span>
                    <span className="block truncate text-xs text-meta-4 mt-0.5 max-w-md">
                      {row.image_url}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-red-600 text-sm shrink-0"
                  onClick={async () => {
                    if (!confirm("Delete this category tile?")) return;
                    await j(
                      await fetch(`/api/admin/marketing/category-tiles/${row.id}`, {
                        method: "DELETE",
                      })
                    );
                    toast.success("Deleted");
                    void refreshCategoryGrid();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              try {
                const categoryId = String(fd.get("category_id") ?? "");
                if (!categoryId) throw new Error("Choose a category");

                let imageUrl = String(fd.get("image_url") ?? "").trim();
                let imagePublicId: string | null = null;
                const file = fd.get("image_file");
                if (file instanceof File && file.size > 0) {
                  setCategoryGridUploading(true);
                  const uploadFd = new FormData();
                  uploadFd.append("file", file);
                  const uploadRes = await j<{ url: string; public_id: string }>(
                    await fetch("/api/admin/marketing/category-tiles/upload", {
                      method: "POST",
                      body: uploadFd,
                    })
                  );
                  imageUrl = uploadRes.url;
                  imagePublicId = uploadRes.public_id;
                }
                if (!imageUrl) throw new Error("Provide an image URL or upload an image");

                await j(
                  await fetch("/api/admin/marketing/category-tiles", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      category_id: categoryId,
                      image_url: imageUrl,
                      image_public_id: imagePublicId,
                      label_override: String(fd.get("label_override") ?? "").trim() || null,
                      sort_order: Number(fd.get("sort_order") || 0),
                      is_active: fd.get("is_active") === "on",
                    }),
                  })
                );
                toast.success("Created");
                formEl.reset();
                void refreshCategoryGrid();
                router.refresh();
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed");
              } finally {
                setCategoryGridUploading(false);
              }
            }}
          >
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Category (shop link)</span>
              <select
                name="category_id"
                required
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              >
                <option value="">— Select —</option>
                {categoryOptionsForGrid}
              </select>
              {categoryOptionsForGrid.length === 0 ? (
                <p className="mt-1 text-xs text-meta-3">
                  All categories already have a tile. Delete one to add a different category.
                </p>
              ) : null}
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Label on tile (optional)</span>
              <input
                name="label_override"
                placeholder="Uses catalog category name if empty"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Image URL (optional if uploading)</span>
              <input name="image_url" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Upload image (Cloudinary)</span>
              <input
                name="image_file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-meta-3">Landscape or square works well for the card. Max 4 MB.</p>
            </label>
            <label>
              <span className="text-sm font-medium">Sort</span>
              <input
                name="sort_order"
                type="number"
                defaultValue={0}
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input name="is_active" type="checkbox" defaultChecked /> Active
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={categoryGridUploading}
                className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {categoryGridUploading ? "Uploading…" : "Add category tile"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === "announcements" ? (
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Announcement bar</h2>
          <p className="text-sm text-meta-3">
            UTILITY = top gray strip (left of welcome). MARQUEE = scrolling row below.
          </p>
          <ul className="divide-y divide-gray-3 text-sm">
            {announcements.map((row: any) => (
              <li key={row.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {row.placement}: {row.body}
                </span>
                <button
                  type="button"
                  className="text-red-600 text-sm"
                  onClick={async () => {
                    if (!confirm("Delete?")) return;
                    await j(
                      await fetch(`/api/admin/marketing/announcements/${row.id}`, { method: "DELETE" })
                    );
                    toast.success("Deleted");
                    void refreshAnnouncements();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              try {
                await j(
                  await fetch("/api/admin/marketing/announcements", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      placement: fd.get("placement"),
                      body: fd.get("body"),
                      link_url: fd.get("link_url") || null,
                      link_label: fd.get("link_label") || null,
                      sort_order: Number(fd.get("sort_order") || 0),
                      is_active: fd.get("is_active") === "on",
                    }),
                  })
                );
                toast.success("Created");
                formEl.reset();
                void refreshAnnouncements();
              } catch (err: any) {
                toast.error(err?.message || "Failed");
              }
            }}
          >
            <label>
              <span className="text-sm font-medium">Placement</span>
              <select name="placement" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm">
                <option value="UTILITY">UTILITY</option>
                <option value="MARQUEE">MARQUEE</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">Sort</span>
              <input name="sort_order" type="number" defaultValue={0} className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Body</span>
              <textarea name="body" required rows={2} className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-sm font-medium">Link URL</span>
              <input name="link_url" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-sm font-medium">Link label</span>
              <input name="link_label" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input name="is_active" type="checkbox" defaultChecked /> Active
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
                Add
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === "popups" ? (
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Popup campaigns</h2>
          <ul className="divide-y divide-gray-3 text-sm">
            {popups.map((row: any) => (
              <li key={row.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {row.title}
                  <span className="ml-2 text-xs text-meta-3">
                    {Number(row.auto_close_ms ?? 0) > 0
                      ? `auto-close ${(Number(row.auto_close_ms) / 1000).toFixed(1)}s`
                      : "no auto-close"}
                  </span>
                </span>
                <button
                  type="button"
                  className="text-red-600 text-sm"
                  onClick={async () => {
                    if (!confirm("Delete?")) return;
                    await j(await fetch(`/api/admin/marketing/popups/${row.id}`, { method: "DELETE" }));
                    toast.success("Deleted");
                    void refreshPopups();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              try {
                let imageUrl = String(fd.get("image_url") ?? "").trim();
                const popupFile = fd.get("image_file");
                if (popupFile instanceof File && popupFile.size > 0) {
                  setPopupUploading(true);
                  const uploadFd = new FormData();
                  uploadFd.append("file", popupFile);
                  const uploadRes = await j<{ url: string }>(
                    await fetch("/api/admin/marketing/popups/upload", {
                      method: "POST",
                      body: uploadFd,
                    })
                  );
                  imageUrl = uploadRes.url;
                }
                await j(
                  await fetch("/api/admin/marketing/popups", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      title: fd.get("title"),
                      body: fd.get("body"),
                      image_url: imageUrl || null,
                      cta_label: fd.get("cta_label") || null,
                      cta_url: fd.get("cta_url") || null,
                      delay_ms: Number(fd.get("delay_ms") || 0),
                      auto_close_ms: Math.max(0, Number(fd.get("auto_close_seconds") || 0) * 1000),
                      frequency: fd.get("frequency"),
                      audience: fd.get("audience"),
                      suggested_coupon_code: fd.get("suggested_coupon_code") || null,
                      sort_priority: Number(fd.get("sort_priority") || 0),
                      is_active: fd.get("is_active") === "on",
                    }),
                  })
                );
                toast.success("Created");
                formEl.reset();
                void refreshPopups();
              } catch (err: any) {
                toast.error(err?.message || "Failed");
              } finally {
                setPopupUploading(false);
              }
            }}
          >
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Title</span>
              <input name="title" required className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Body</span>
              <textarea name="body" required rows={3} className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Image URL (optional if uploading)</span>
              <input name="image_url" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Upload Image (Cloudinary)</span>
              <input
                name="image_file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-meta-3">If both are provided, uploaded file is used.</p>
            </label>
            <label>
              <span className="text-sm font-medium">CTA label</span>
              <input name="cta_label" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-sm font-medium">CTA URL</span>
              <input name="cta_url" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-sm font-medium">Delay (ms)</span>
              <input name="delay_ms" type="number" defaultValue={0} className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-sm font-medium">Auto close after (seconds)</span>
              <input
                name="auto_close_seconds"
                type="number"
                min={0}
                step="0.5"
                defaultValue={0}
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <label>
              <span className="text-sm font-medium">Sort priority</span>
              <input name="sort_priority" type="number" defaultValue={0} className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="text-sm font-medium">Frequency</span>
              <select name="frequency" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm">
                <option value="ONCE_PER_SESSION">ONCE_PER_SESSION</option>
                <option value="ONCE_PER_DEVICE">ONCE_PER_DEVICE</option>
                <option value="EVERY_VISIT">EVERY_VISIT</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">Audience</span>
              <select name="audience" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm">
                <option value="ALL">ALL</option>
                <option value="GUESTS_ONLY">GUESTS_ONLY</option>
                <option value="LOGGED_IN_ONLY">LOGGED_IN_ONLY</option>
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Suggested coupon code</span>
              <input name="suggested_coupon_code" className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input name="is_active" type="checkbox" defaultChecked /> Active
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={popupUploading}
                className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {popupUploading ? "Uploading..." : "Add popup"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === "flash" ? (
        <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Flash sale prices</h2>
          <p className="text-sm text-meta-3">
            Overrides catalog unit price at checkout when active (and in window).
          </p>
          <ul className="divide-y divide-gray-3 text-sm">
            {flashSales.map((row: any) => (
              <li key={row.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                {flashEditingId === row.id ? (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <span className="min-w-[180px] font-medium text-dark">
                      {row.products?.name ?? row.product_id}
                    </span>
                    <input
                      value={flashEditPrice}
                      onChange={(e) => setFlashEditPrice(e.target.value)}
                      type="number"
                      step="0.01"
                      className="w-32 rounded-lg border border-gray-3 px-3 py-1.5 text-sm"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={flashEditActive}
                        onChange={(e) => setFlashEditActive(e.target.checked)}
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      className="rounded bg-blue px-3 py-1.5 text-xs font-medium text-white"
                      onClick={async () => {
                        const entered = Number(flashEditPrice);
                        const listed = listedPriceForProduct(row.product_id);
                        if (!Number.isFinite(entered) || entered <= 0) {
                          toast.error("Enter valid sale price");
                          return;
                        }
                        if (listed != null && !(entered < listed)) {
                          toast.error(`Flash sale must be lower than listed price ₹${listed}`);
                          return;
                        }
                        await j(
                          await fetch(`/api/admin/marketing/flash-sales/${row.id}`, {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ sale_price: entered, is_active: flashEditActive }),
                          })
                        );
                        setFlashSales((prev: any[]) =>
                          prev.map((x) =>
                            x.id === row.id ? { ...x, sale_price: entered, is_active: flashEditActive } : x
                          )
                        );
                        setFlashEditingId(null);
                        toast.success("Flash sale updated");
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="rounded border border-gray-3 px-3 py-1.5 text-xs"
                      onClick={() => setFlashEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span>
                      {row.products?.name ?? row.product_id} — ₹{row.sale_price}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-blue text-sm"
                        onClick={() => {
                          setFlashEditingId(row.id);
                          setFlashEditPrice(String(row.sale_price));
                          setFlashEditActive(Boolean(row.is_active));
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600 text-sm"
                        onClick={async () => {
                          if (!confirm("Delete?")) return;
                          await j(
                            await fetch(`/api/admin/marketing/flash-sales/${row.id}`, { method: "DELETE" })
                          );
                          toast.success("Deleted");
                          void refreshFlash();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              setFlashSaving(true);
              try {
                const selectedProductId = String(fd.get("product_id") ?? "");
                const selectedProduct = prods.find((p) => p.id === selectedProductId);
                const listedPrice = selectedProduct
                  ? Number(selectedProduct.discounted_price ?? selectedProduct.base_price)
                  : null;
                const enteredPrice = Number(fd.get("sale_price"));
                if (listedPrice != null && !(enteredPrice < listedPrice)) {
                  toast.error(`Flash sale must be lower than listed price ₹${listedPrice}`);
                  return;
                }

                const saved = await j<{ item?: any }>(
                  await fetch("/api/admin/marketing/flash-sales", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      product_id: selectedProductId,
                      sale_price: enteredPrice,
                      is_active: fd.get("is_active") === "on",
                    }),
                  })
                );
                toast.success("Flash sale saved (created or updated)");
                formEl.reset();
                if (saved?.item) {
                  setFlashSales((prev: any[]) => {
                    const exists = prev.some((x) => x.id === saved.item.id);
                    const next = exists
                      ? prev.map((x) => (x.id === saved.item.id ? saved.item : x))
                      : [saved.item, ...prev];
                    return next;
                  });
                }
                await refreshFlash();
                router.refresh();
              } catch (err: any) {
                toast.error(err?.message || "Failed");
              } finally {
                setFlashSaving(false);
              }
            }}
          >
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Product</span>
              <select name="product_id" required className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm">
                <option value="">Select…</option>
                {productOptions}
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">Sale price (INR)</span>
              <input name="sale_price" type="number" step="0.01" required className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input name="is_active" type="checkbox" defaultChecked /> Active
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={flashSaving}
                className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {flashSaving ? "Saving..." : "Add flash sale"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === "settings" ? (
        <div className="space-y-8">
          <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4 max-w-lg">
            <h2 className="text-lg font-semibold">First-visit coupon</h2>
            <p className="text-sm text-meta-3">
              Choose from existing active coupons. Offer is enforced one-time per customer email.
            </p>
            <label className="block">
              <span className="text-sm font-medium">Coupon</span>
              <select
                value={firstVisit}
                onChange={(e) => setFirstVisit(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              >
                <option value="">No first-visit coupon</option>
                {couponOptions}
              </select>
            </label>
            <button
              type="button"
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white"
              onClick={async () => {
                try {
                  await j(
                    await fetch("/api/admin/marketing/settings", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        first_visit_coupon_code: firstVisit.trim() || null,
                      }),
                    })
                  );
                  toast.success("Saved");
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              Save coupon
            </button>
          </section>

          <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4 max-w-3xl">
            <h2 className="text-lg font-semibold">Quick Links pages content</h2>
            <p className="text-sm text-meta-3">
              Edit the title, subtitle, and page body (rich text). Content is stored as HTML and shown
              formatted on Privacy Policy, Terms &amp; Conditions, Return &amp; Cancellation, FAQ, and
              Contact pages.
            </p>

            <label className="block max-w-sm">
              <span className="text-sm font-medium">Page</span>
              <select
                value={quickLinkPageKey}
                onChange={(e) => {
                  const key = e.target.value as QuickLinkPageAdminKey;
                  setQuickLinkPageKey(key);
                  setQuickLinkTitle(quickLinkPages[key].title);
                  setQuickLinkSubtitle(quickLinkPages[key].subtitle);
                  setQuickLinkContent(quickLinkPages[key].content);
                }}
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              >
                <option value="privacy">Privacy Policy</option>
                <option value="terms">Terms &amp; Conditions</option>
                <option value="returns">Return &amp; Cancellation</option>
                <option value="faq">FAQ</option>
                <option value="contact">Contact</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Title</span>
              <input
                value={quickLinkTitle}
                onChange={(e) => setQuickLinkTitle(e.target.value)}
                placeholder={`${quickLinkFieldMap[quickLinkPageKey].label}`}
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Subtitle</span>
              <input
                value={quickLinkSubtitle}
                onChange={(e) => setQuickLinkSubtitle(e.target.value)}
                placeholder="One-line intro below title"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <div className="block">
              <span className="text-sm font-medium">Content</span>
              <QuickLinkHtmlEditor
                editorKey={quickLinkPageKey}
                value={quickLinkContent}
                onChange={setQuickLinkContent}
              />
            </div>
            <button
              type="button"
              disabled={quickLinkSaving}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={async () => {
                try {
                  setQuickLinkSaving(true);
                  const map = quickLinkFieldMap[quickLinkPageKey];
                  const row = await j<SiteSettingsRow>(
                    await fetch("/api/admin/marketing/settings", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        [map.title]: quickLinkTitle.trim() || null,
                        [map.subtitle]: quickLinkSubtitle.trim() || null,
                        [map.content]: quickLinkContent.trim() || null,
                      }),
                    })
                  );
                  const next = {
                    title: String((row[map.title] ?? "") as string),
                    subtitle: String((row[map.subtitle] ?? "") as string),
                    content: String((row[map.content] ?? "") as string),
                  };
                  setQuickLinkPages((prev) => ({ ...prev, [quickLinkPageKey]: next }));
                  setQuickLinkTitle(next.title);
                  setQuickLinkSubtitle(next.subtitle);
                  setQuickLinkContent(next.content);
                  toast.success("Page content saved");
                  router.refresh();
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                } finally {
                  setQuickLinkSaving(false);
                }
              }}
            >
              {quickLinkSaving ? "Saving…" : "Save page content"}
            </button>
          </section>

          <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4 max-w-2xl">
            <h2 className="text-lg font-semibold">Footer: Help &amp; Support</h2>
            <p className="text-sm text-meta-3">
              Shown in the site footer (address, phone, email, social icons). Leave any field empty and
              save to use the built-in default for that field.
            </p>
            <label className="block">
              <span className="text-sm font-medium">Section title</span>
              <input
                value={helpSupportTitle}
                onChange={(e) => setHelpSupportTitle(e.target.value)}
                placeholder="Help & Support"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Address</span>
              <textarea
                value={contactAddress}
                onChange={(e) => setContactAddress(e.target.value)}
                rows={3}
                placeholder="Store address"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Phone (display)</span>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98447 16214"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="support@example.com"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Facebook URL</span>
                <input
                  value={socialFacebook}
                  onChange={(e) => setSocialFacebook(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Twitter / X URL</span>
                <input
                  value={socialTwitter}
                  onChange={(e) => setSocialTwitter(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Instagram URL</span>
                <input
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">LinkedIn URL</span>
                <input
                  value={socialLinkedIn}
                  onChange={(e) => setSocialLinkedIn(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={storefrontSaving}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={async () => {
                try {
                  setStorefrontSaving(true);
                  const row = await j<SiteSettingsRow>(
                    await fetch("/api/admin/marketing/settings", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        help_support_title: helpSupportTitle.trim() || null,
                        contact_address: contactAddress.trim() || null,
                        contact_phone: contactPhone.trim() || null,
                        contact_email: contactEmail.trim() || null,
                        social_facebook_url: socialFacebook.trim() || null,
                        social_twitter_url: socialTwitter.trim() || null,
                        social_instagram_url: socialInstagram.trim() || null,
                        social_linkedin_url: socialLinkedIn.trim() || null,
                      }),
                    })
                  );
                  setHelpSupportTitle(row.help_support_title ?? "");
                  setContactAddress(row.contact_address ?? "");
                  setContactPhone(row.contact_phone ?? "");
                  setContactEmail(row.contact_email ?? "");
                  setSocialFacebook(row.social_facebook_url ?? "");
                  setSocialTwitter(row.social_twitter_url ?? "");
                  setSocialInstagram(row.social_instagram_url ?? "");
                  setSocialLinkedIn(row.social_linkedin_url ?? "");
                  toast.success("Storefront contact saved");
                  router.refresh();
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                } finally {
                  setStorefrontSaving(false);
                }
              }}
            >
              {storefrontSaving ? "Saving…" : "Save footer"}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
