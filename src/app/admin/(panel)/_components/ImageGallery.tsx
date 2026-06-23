"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import PickFromCloudinaryButton from "@/components/admin/PickFromCloudinaryButton";
import type { CloudinaryFolderId } from "@/lib/cloudinary/adminImageUploadConstants";

export interface GalleryImage {
  id?: string;
  url: string;
  uploading?: boolean;
  alt_text?: string | null;
  sort_order?: number;
}

interface Props {
  images: GalleryImage[];
  /** Called after drag-drop reorder completes */
  onReorder: (images: GalleryImage[]) => void;
  /** Called when the × button is clicked */
  onDelete: (img: GalleryImage, idx: number) => void;
  /** Called when files are picked via button or file-drop */
  onAddFiles: (files: FileList) => void;
  /** Called when images are picked from Cloudinary library */
  onPickUrls?: (urls: string[]) => void | Promise<void>;
  cloudinaryFolder?: CloudinaryFolderId;
  disabled?: boolean;
}

export default function ImageGallery({
  images,
  onReorder,
  onDelete,
  onAddFiles,
  onPickUrls,
  cloudinaryFolder = "irobox/products",
  disabled,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, i: number) {
    dragFrom.current = i;
    e.dataTransfer.effectAllowed = "move";
    // store index as text so browser doesn't complain
    e.dataTransfer.setData("text/plain", String(i));
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    // Only handle tile-to-tile reorder, not file drops
    if (e.dataTransfer.types.includes("text/plain")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIdx(i);
    }
  }

  function handleDrop(e: React.DragEvent, toIdx: number) {
    // Tile reorder
    if (e.dataTransfer.types.includes("text/plain")) {
      e.preventDefault();
      e.stopPropagation();
      setDragOverIdx(null);
      const from = dragFrom.current;
      if (from === null || from === toIdx) return;
      const reordered = [...images];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(toIdx, 0, moved);
      dragFrom.current = null;
      onReorder(reordered);
    }
  }

  function handleDragEnd() {
    dragFrom.current = null;
    setDragOverIdx(null);
  }

  return (
    <div>
      {/* Grid */}
      <div
        className="flex flex-wrap gap-3"
        onDragOver={(e) => {
          // Allow file drops on the container
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={(e) => {
          if (e.dataTransfer.files.length) {
            e.preventDefault();
            if (!disabled) onAddFiles(e.dataTransfer.files);
          }
        }}
      >
        {images.map((img, i) => (
          <div
            key={img.id ?? `uploading-${i}`}
            draggable={!img.uploading && !disabled}
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            className={[
              "relative w-24 h-24 rounded-xl overflow-hidden border bg-gray-1 select-none",
              !img.uploading && !disabled ? "cursor-grab active:cursor-grabbing" : "",
              dragOverIdx === i
                ? "border-blue ring-2 ring-blue/30 scale-105"
                : "border-gray-3",
              "transition-all duration-100",
            ].join(" ")}
          >
            {img.uploading ? (
              /* Spinner */
              <div className="flex h-full flex-col items-center justify-center gap-1.5">
                <svg
                  className="animate-spin h-5 w-5 text-blue"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span className="text-[10px] text-meta-3">Uploading…</span>
              </div>
            ) : (
              <>
                <Image
                  src={img.url}
                  alt={img.alt_text ?? ""}
                  fill
                  className="object-cover pointer-events-none"
                  unoptimized
                />

                {/* Cover badge on first image */}
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 bg-blue/80 text-white text-[9px] text-center py-0.5 font-semibold tracking-wide pointer-events-none">
                    COVER
                  </span>
                )}

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => !disabled && onDelete(img, i)}
                  className="absolute top-1 right-1 z-20 rounded-full border border-red-200 bg-red-600 text-white w-6 h-6 flex items-center justify-center text-sm leading-none hover:bg-red-700 transition"
                  title="Remove image"
                  aria-label="Remove image"
                >
                  ×
                </button>

                {/* Drag handle hint */}
                <div className="absolute top-1 left-1 text-white/60 pointer-events-none">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                  </svg>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Add from computer */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-3 hover:border-blue flex flex-col items-center justify-center gap-1 text-meta-3 hover:text-blue transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="text-xs">Upload</span>
        </button>

        {onPickUrls ? (
          <div className="flex w-24 h-24 flex-col items-center justify-center">
            <PickFromCloudinaryButton
              folder={cloudinaryFolder}
              multiple
              disabled={disabled}
              label="Library"
              className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-3 px-1 text-xs font-medium text-meta-3 hover:border-blue hover:text-blue disabled:opacity-50"
              onSelect={(urls) => void onPickUrls(urls)}
            />
          </div>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length && !disabled) onAddFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs text-meta-4">
        Drag tiles to reorder · First image is the cover · Upload or pick from Cloudinary · JPEG, PNG,
        WebP or GIF · max 9 MB each
      </p>
    </div>
  );
}
