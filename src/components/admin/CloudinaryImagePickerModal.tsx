"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";
import {
  CLOUDINARY_ADMIN_IMAGE_FOLDERS,
  type CloudinaryFolderId,
} from "@/lib/cloudinary/adminImageUploadConstants";

type BrowseItem = {
  url: string;
  thumb_url: string;
  public_id: string;
  width: number;
  height: number;
  created_at: string;
  format: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (urls: string[]) => void;
  defaultFolder?: CloudinaryFolderId;
  multiple?: boolean;
  title?: string;
};

const SKELETON_COUNT = 15;

async function parseBrowseResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Could not load images");
  }
  return data as {
    items: BrowseItem[];
    next_cursor: string | null;
    folder: string;
  };
}

function PreviewSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={i}
          className="aspect-square animate-pulse rounded-xl border border-gray-3 bg-gray-2"
        />
      ))}
    </div>
  );
}

export default function CloudinaryImagePickerModal({
  open,
  onClose,
  onSelect,
  defaultFolder = "irobox/products",
  multiple = true,
  title = "Choose from Cloudinary",
}: Props) {
  const [folder, setFolder] = useState<CloudinaryFolderId>(defaultFolder);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadFolder = useCallback(async (targetFolder: string, cursor?: string | null) => {
    const isMore = Boolean(cursor);
    if (isMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ folder: targetFolder, limit: "48" });
      if (cursor) params.set("cursor", cursor);

      const data = await parseBrowseResponse(
        await fetchAdminWithRetry(`/api/admin/media/browse?${params}`, {
          cache: "no-store",
          credentials: "include",
        })
      );

      setItems((prev) => (isMore ? [...prev, ...data.items] : data.items));
      setNextCursor(data.next_cursor);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load images");
      if (!isMore) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setFolder(defaultFolder);
    setSelected(new Set());
    setQuery("");
    setItems([]);
    setNextCursor(null);
    void loadFolder(defaultFolder);
  }, [open, defaultFolder, loadFolder]);

  function changeFolder(next: CloudinaryFolderId) {
    setFolder(next);
    setSelected(new Set());
    setQuery("");
    setItems([]);
    setNextCursor(null);
    void loadFolder(next);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.public_id.toLowerCase().includes(q));
  }, [items, query]);

  function toggleItem(url: string) {
    if (!multiple) {
      setSelected(new Set([url]));
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function confirmSelection() {
    const urls = multiple ? Array.from(selected) : Array.from(selected).slice(0, 1);
    if (urls.length === 0) {
      toast.error("Select at least one image");
      return;
    }
    onSelect(urls);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex h-[min(90vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-3 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-3 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-dark">{title}</h2>
            <p className="mt-1 text-sm text-meta-3">
              Newest uploads first · pick existing images — no re-upload.{" "}
              {multiple ? "Select one or more." : "Select one image."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-medium text-meta-3 hover:bg-gray-1 hover:text-dark"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-gray-3 px-5 py-3">
          <label className="min-w-[200px] flex-1">
            <span className="block text-xs font-medium text-meta-3">Folder</span>
            <select
              value={folder}
              onChange={(e) => changeFolder(e.target.value as CloudinaryFolderId)}
              className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm outline-none focus:border-blue"
            >
              {CLOUDINARY_ADMIN_IMAGE_FOLDERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[200px] flex-[2]">
            <span className="block text-xs font-medium text-meta-3">Search filename</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name…"
              className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              <p className="text-sm text-meta-3">Loading previews…</p>
              <PreviewSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-3 bg-gray-1/40 px-4 py-10 text-center text-sm text-meta-3">
              {query.trim()
                ? "No images match your search in this folder."
                : "No images in this folder yet. Upload some from Media upload first."}
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-meta-3">
                Showing {filtered.length} preview{filtered.length === 1 ? "" : "s"}
                {query.trim() ? " (filtered)" : " · newest first"}
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {filtered.map((item, index) => {
                  const isSelected = selected.has(item.url);
                  const label = item.public_id.split("/").pop() ?? item.public_id;
                  return (
                    <button
                      key={item.public_id}
                      type="button"
                      onClick={() => toggleItem(item.url)}
                      className={`relative aspect-square overflow-hidden rounded-xl border bg-gray-1 text-left transition ${
                        isSelected
                          ? "border-blue ring-2 ring-blue/30"
                          : "border-gray-3 hover:border-blue/60"
                      }`}
                      title={item.public_id}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.thumb_url || item.url}
                        alt={label}
                        loading={index < 12 ? "eager" : "lazy"}
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                      {isSelected ? (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue text-[11px] font-bold text-white">
                          ✓
                        </span>
                      ) : null}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {loadingMore ? (
            <div className="mt-4">
              <PreviewSkeleton />
            </div>
          ) : null}

          {nextCursor && !query.trim() && !loading ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadFolder(folder, nextCursor)}
                className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 disabled:opacity-60"
              >
                Load older images
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-3 px-5 py-4">
          <p className="text-sm text-meta-3">
            {selected.size > 0 ? (
              <span>
                <span className="font-semibold text-dark">{selected.size}</span> selected
              </span>
            ) : (
              "Nothing selected"
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmSelection}
              disabled={selected.size === 0}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark disabled:opacity-60"
            >
              Use selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
