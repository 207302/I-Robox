"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import AdminImageUrlField from "@/components/admin/AdminImageUrlField";
import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";

type CatalogRow = { id: string; name: string; slug: string };

type Tab = "brands" | "categories";

async function uploadBannerFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/admin/page-banners/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  if (!data.url) throw new Error("Upload failed");
  return data.url;
}

function BannerEditor({
  kind,
  catalog,
  selectedId,
  onSelectId,
}: {
  kind: Tab;
  catalog: CatalogRow[];
  selectedId: string;
  onSelectId: (id: string) => void;
}) {
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Brand description (brands tab only). savedDescription tracks the value
  // persisted in the DB so the save button only lights up on real edits.
  const [description, setDescription] = useState("");
  const [savedDescription, setSavedDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);

  const apiBase = kind === "brands" ? "/api/admin/brand-pages" : "/api/admin/category-pages";

  const loadPage = useCallback(async (id: string) => {
    if (!id) {
      setHeroImage(null);
      setDescription("");
      setSavedDescription("");
      return;
    }
    setLoading(true);
    try {
      const res = await fetchAdminWithRetry(`${apiBase}/${id}`);
      const data = (await res.json()) as {
        heroImage?: string | null;
        description?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setHeroImage(data.heroImage ?? null);
      setDescription(data.description ?? "");
      setSavedDescription(data.description ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
      setHeroImage(null);
      setDescription("");
      setSavedDescription("");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void loadPage(selectedId);
  }, [selectedId, loadPage]);

  async function saveHeroImage(next: string | null) {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetchAdminWithRetry(`${apiBase}/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroImage: next }),
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; heroImage?: string | null };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setHeroImage(data.heroImage ?? null);
      toast.success(next ? "Banner saved" : "Banner removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveDescription() {
    if (!selectedId) return;
    setSavingDescription(true);
    try {
      const trimmed = description.trim();
      const res = await fetchAdminWithRetry(`${apiBase}/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed || null }),
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; description?: string | null };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setDescription(data.description ?? "");
      setSavedDescription(data.description ?? "");
      toast.success(trimmed ? "Description saved" : "Description cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingDescription(false);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedId) return;
    setUploading(true);
    try {
      const url = await uploadBannerFile(file);
      setHeroImage(url);
      await saveHeroImage(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const selected = catalog.find((row) => row.id === selectedId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-meta-3">
        If no banner is uploaded, the page will show a default gradient header.
      </p>

      <label>
        <span className="text-sm font-medium">
          {kind === "brands" ? "Brand" : "Category"}
        </span>
        <select
          value={selectedId}
          onChange={(e) => onSelectId(e.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-gray-3 px-3 py-2 text-sm"
        >
          <option value="">— Select —</option>
          {catalog.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>

      {selectedId ? (
        <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-dark">{selected?.name}</h2>
          {loading ? (
            <p className="text-sm text-meta-3">Loading…</p>
          ) : heroImage ? (
            <div className="relative aspect-[5/2] w-full max-w-3xl overflow-hidden rounded-xl bg-gray-1">
              <Image
                src={heroImage}
                alt={`${selected?.name ?? "Page"} banner preview`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>
          ) : (
            <div className="flex aspect-[5/2] w-full max-w-3xl items-center justify-center rounded-xl bg-gradient-to-r from-blue to-blue-dark text-sm text-white">
              Default gradient (no banner uploaded)
            </div>
          )}

          <AdminImageUrlField
            label="Banner image URL"
            name="hero_image"
            folder="irobox/page-banners"
            value={heroImage ?? ""}
            onChange={(url) => setHeroImage(url || null)}
          />

          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              {uploading ? "Uploading…" : "Upload new banner"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                disabled={uploading || saving}
                onChange={(e) => void onFileChange(e)}
              />
            </label>
            <button
              type="button"
              disabled={!heroImage || saving || uploading}
              onClick={() => void saveHeroImage(heroImage)}
              className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save URL"}
            </button>
            <button
              type="button"
              disabled={!heroImage || saving || uploading}
              onClick={() => void saveHeroImage(null)}
              className="rounded-lg border border-red/30 bg-white px-4 py-2 text-sm font-medium text-red hover:bg-red/5 disabled:opacity-50"
            >
              Remove banner
            </button>
          </div>

          {kind === "brands" ? (
            <div className="space-y-2 border-t border-gray-3 pt-4">
              <label className="block">
                <span className="text-sm font-medium">Brand description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  disabled={loading || savingDescription}
                  placeholder="Shown on the brand page and used as its meta description. Leave empty to hide the description."
                  className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm disabled:bg-gray-1"
                />
              </label>
              <p className="text-xs text-meta-3">
                Optional. Only shown on the brand page when filled in.
              </p>
              <button
                type="button"
                disabled={savingDescription || loading || description.trim() === savedDescription.trim()}
                onClick={() => void saveDescription()}
                className="rounded-lg bg-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {savingDescription ? "Saving…" : "Save description"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function RoutePagesAdminClient() {
  const [tab, setTab] = useState<Tab>("brands");
  const [brands, setBrands] = useState<CatalogRow[]>([]);
  const [categories, setCategories] = useState<CatalogRow[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [brandsRes, categoriesRes] = await Promise.all([
          fetchAdminWithRetry("/api/admin/brands"),
          fetchAdminWithRetry("/api/admin/categories"),
        ]);
        const brandsData = (await brandsRes.json()) as CatalogRow[];
        const categoriesData = (await categoriesRes.json()) as CatalogRow[];
        if (brandsRes.ok) setBrands(brandsData);
        if (categoriesRes.ok) setCategories(categoriesData);
      } catch {
        toast.error("Failed to load brands and categories");
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark">Page banners</h1>
        <p className="mt-1 text-sm text-meta-3">
          Upload hero banners for brand and category landing pages.
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-3">
        {(["brands", "categories"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition ${
              tab === key
                ? "border-blue text-blue"
                : "border-transparent text-meta-3 hover:text-dark"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {tab === "brands" ? (
        <BannerEditor
          kind="brands"
          catalog={brands}
          selectedId={selectedBrandId}
          onSelectId={setSelectedBrandId}
        />
      ) : (
        <BannerEditor
          kind="categories"
          catalog={categories}
          selectedId={selectedCategoryId}
          onSelectId={setSelectedCategoryId}
        />
      )}
    </div>
  );
}
