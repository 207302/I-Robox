const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  pjpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Browsers on Windows sometimes send an empty or generic MIME type for images. */
export function resolveImageMimeType(fileName: string, reportedType?: string | null): string | null {
  const type = reportedType?.trim().toLowerCase() ?? "";
  if (type.startsWith("image/")) return type;

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}

export function isAllowedImageMime(mime: string | null): mime is string {
  if (!mime) return false;
  return (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    mime === "image/gif" ||
    mime === "image/jpg" ||
    mime === "image/pjpeg"
  );
}
