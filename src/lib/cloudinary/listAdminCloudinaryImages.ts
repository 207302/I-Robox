import "server-only";

import { v2 as cloudinary } from "cloudinary";
import { configureCloudinaryAdmin } from "@/lib/cloudinary/adminImageUpload";

export type CloudinaryBrowseItem = {
  url: string;
  thumb_url: string;
  public_id: string;
  width: number;
  height: number;
  created_at: string;
  format: string;
};

function mapResource(r: {
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  created_at?: string;
  format?: string;
}): CloudinaryBrowseItem | null {
  const publicId = r.public_id;
  const url = r.secure_url;
  if (!publicId || !url) return null;

  return {
    url,
    thumb_url: cloudinary.url(publicId, {
      secure: true,
      transformation: [
        { width: 140, height: 140, crop: "fill", quality: "auto:eco", fetch_format: "auto" },
      ],
    }),
    public_id: publicId,
    width: Number(r.width ?? 0),
    height: Number(r.height ?? 0),
    created_at: String(r.created_at ?? ""),
    format: String(r.format ?? ""),
  };
}

function sortNewestFirst(items: CloudinaryBrowseItem[]): CloudinaryBrowseItem[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.created_at) || 0;
    const bTime = Date.parse(b.created_at) || 0;
    if (bTime !== aTime) return bTime - aTime;
    return b.public_id.localeCompare(a.public_id);
  });
}

async function listViaSearch(input: {
  folder: string;
  maxResults: number;
  nextCursor?: string | null;
}): Promise<{ items: CloudinaryBrowseItem[]; next_cursor: string | null }> {
  const expression = `resource_type:image AND public_id:${input.folder}/*`;
  let chain = cloudinary.search
    .expression(expression)
    .sort_by("created_at", "desc")
    .max_results(input.maxResults);

  if (input.nextCursor) {
    chain = chain.next_cursor(input.nextCursor);
  }

  const result = await chain.execute();
  const items = (result.resources ?? [])
    .map((r) => mapResource(r as Parameters<typeof mapResource>[0]))
    .filter((item): item is CloudinaryBrowseItem => item != null);

  return {
    items,
    next_cursor: (result.next_cursor as string | undefined) ?? null,
  };
}

async function listViaResourcesApi(input: {
  folder: string;
  maxResults: number;
  nextCursor?: string | null;
}): Promise<{ items: CloudinaryBrowseItem[]; next_cursor: string | null }> {
  const result = await cloudinary.api.resources({
    type: "upload",
    resource_type: "image",
    prefix: `${input.folder}/`,
    max_results: input.maxResults,
    ...(input.nextCursor ? { next_cursor: input.nextCursor } : {}),
  });

  const items = sortNewestFirst(
    (result.resources ?? [])
      .map((r) => mapResource(r))
      .filter((item): item is CloudinaryBrowseItem => item != null)
  );

  return {
    items,
    next_cursor: (result.next_cursor as string | undefined) ?? null,
  };
}

export async function listCloudinaryAdminImages(input: {
  folder: string;
  maxResults?: number;
  nextCursor?: string | null;
}): Promise<{
  items: CloudinaryBrowseItem[];
  next_cursor: string | null;
}> {
  configureCloudinaryAdmin();

  const maxResults = Math.max(1, Math.min(input.maxResults ?? 48, 100));

  try {
    return await listViaSearch({ ...input, maxResults });
  } catch (searchErr) {
    console.warn("[cloudinary/browse] search API failed, falling back to resources", searchErr);
    return listViaResourcesApi({ ...input, maxResults });
  }
}
