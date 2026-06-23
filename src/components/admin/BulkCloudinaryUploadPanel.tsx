"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ADMIN_IMAGE_MAX_BYTES,
  CLOUDINARY_ADMIN_IMAGE_FOLDERS,
} from "@/lib/cloudinary/adminImageUploadConstants";

type UploadStatus = "queued" | "uploading" | "done" | "error";

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  url?: string;
  error?: string;
};

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const UPLOAD_CONCURRENCY = 3;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function nextId() {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function BulkCloudinaryUploadPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<string>(CLOUDINARY_ADMIN_IMAGE_FOLDERS[0].id);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const valid: UploadItem[] = [];
    let skipped = 0;

    for (const file of fileArr) {
      if (!file.type.startsWith("image/")) {
        skipped += 1;
        continue;
      }
      if (file.size > ADMIN_IMAGE_MAX_BYTES) {
        toast.error(`${file.name}: max 9 MB per image`);
        skipped += 1;
        continue;
      }
      valid.push({
        id: nextId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
      });
    }

    if (valid.length === 0) {
      if (skipped > 0) return;
      toast.error("No valid image files selected");
      return;
    }

    setItems((prev) => [...prev, ...valid]);
    if (skipped > 0) {
      toast.error(`${skipped} file(s) skipped (invalid type or too large)`);
    } else {
      toast.success(`Added ${valid.length} image${valid.length === 1 ? "" : "s"} to queue`);
    }
  }, []);

  async function uploadOne(item: UploadItem, targetFolder: string): Promise<UploadItem> {
    const fd = new FormData();
    fd.append("file", item.file);
    fd.append("folder", targetFolder);

    try {
      const res = await fetch("/api/admin/media/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        return { ...item, status: "error", error: data.error || "Upload failed" };
      }
      return { ...item, status: "done", url: data.url };
    } catch (err: unknown) {
      return {
        ...item,
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed",
      };
    }
  }

  async function runUploads() {
    const queued = items.filter((i) => i.status === "queued" || i.status === "error");
    if (queued.length === 0) {
      toast.error("No images waiting to upload");
      return;
    }

    setUploading(true);
    const ids = new Set(queued.map((i) => i.id));
    setItems((prev) =>
      prev.map((i) => (ids.has(i.id) ? { ...i, status: "uploading" as const, error: undefined } : i))
    );

    let sent = 0;
    let failed = 0;
    const queue = [...queued];

    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const result = await uploadOne(item, folder);
        setItems((prev) => prev.map((i) => (i.id === result.id ? result : i)));
        if (result.status === "done") sent += 1;
        else failed += 1;
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queued.length) }, () => worker())
    );

    setUploading(false);
    toast.success(
      `Upload complete — ${sent} succeeded` + (failed > 0 ? `, ${failed} failed` : "")
    );
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function clearCompleted() {
    setItems((prev) => {
      for (const item of prev) {
        if (item.status === "done") URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((i) => i.status !== "done");
    });
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function copyAllUrls() {
    const urls = items.filter((i) => i.url).map((i) => i.url!);
    if (urls.length === 0) {
      toast.error("No uploaded URLs yet");
      return;
    }
    void copyText(urls.join("\n"), `${urls.length} URL(s)`);
  }

  const queuedCount = items.filter((i) => i.status === "queued" || i.status === "error").length;
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <label htmlFor="cloudinary-folder" className="block text-sm font-medium text-dark">
            Cloudinary folder
          </label>
          <select
            id="cloudinary-folder"
            value={folder}
            disabled={uploading}
            onChange={(e) => setFolder(e.target.value)}
            className="rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue min-w-[220px]"
          >
            {CLOUDINARY_ADMIN_IMAGE_FOLDERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-meta-3">Images are converted to WebP (max 1200px) on upload.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 disabled:opacity-60"
          >
            Choose images
          </button>
          <button
            type="button"
            disabled={uploading || queuedCount === 0}
            onClick={() => void runUploads()}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark disabled:opacity-60"
          >
            {uploading ? "Uploading…" : `Upload ${queuedCount || ""}`.trim()}
          </button>
          {doneCount > 0 ? (
            <>
              <button
                type="button"
                onClick={copyAllUrls}
                className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
              >
                Copy all URLs
              </button>
              <button
                type="button"
                onClick={clearCompleted}
                className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
              >
                Clear completed
              </button>
            </>
          ) : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          e.target.value = "";
          if (files?.length) addFiles(files);
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
          dragOver ? "border-blue bg-blue/5" : "border-gray-3 bg-gray-1/40"
        }`}
      >
        <p className="text-sm font-medium text-dark">Drag and drop images here</p>
        <p className="mt-1 text-sm text-meta-3">JPEG, PNG, WebP, or GIF — up to 9 MB each</p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="mt-4 rounded-lg bg-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          Browse files
        </button>
      </div>

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-3">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-1 text-left text-meta-3">
              <tr>
                <th className="px-4 py-3 font-medium">Preview</th>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-3">
              {items.map((item) => (
                <tr key={item.id} className="text-dark">
                  <td className="px-4 py-3">
                    <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-gray-3 bg-gray-1">
                      <Image
                        src={item.previewUrl}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate font-medium">{item.file.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-meta-3">
                    {formatBytes(item.file.size)}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === "queued" && (
                      <span className="text-meta-3">Queued</span>
                    )}
                    {item.status === "uploading" && (
                      <span className="text-blue">Uploading…</span>
                    )}
                    {item.status === "done" && (
                      <span className="text-green-600">Uploaded</span>
                    )}
                    {item.status === "error" && (
                      <span className="text-red-600" title={item.error}>
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-blue hover:underline"
                      >
                        {item.url}
                      </a>
                    ) : item.error ? (
                      <span className="text-xs text-red-600">{item.error}</span>
                    ) : (
                      <span className="text-meta-4">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-2">
                      {item.url ? (
                        <button
                          type="button"
                          onClick={() => void copyText(item.url!, "URL")}
                          className="text-xs font-medium text-blue hover:underline"
                        >
                          Copy
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={uploading && item.status === "uploading"}
                        onClick={() => removeItem(item.id)}
                        className="text-xs font-medium text-meta-3 hover:text-dark disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-meta-3">No images in queue yet.</p>
      )}
    </div>
  );
}
