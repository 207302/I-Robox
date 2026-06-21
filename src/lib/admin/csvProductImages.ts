import type { PrismaClient } from "@prisma/client";

/** One https URL, or several separated by `|`. Invalid entries are skipped. */
export function parseImageUrlsFromCsvCell(raw: unknown): string[] {
  const t = String(raw ?? "").trim();
  if (!t) return [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const part of t.split("|")) {
    const url = part.trim().slice(0, 2000);
    if (!url || seen.has(url)) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
    } catch {
      continue;
    }
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/** Replace product-level gallery images when import provides URLs. */
export async function syncProductImagesFromCsv(
  prisma: PrismaClient,
  productId: string,
  urls: string[]
): Promise<void> {
  if (urls.length === 0) return;
  await prisma.product_images.deleteMany({
    where: { product_id: productId, product_variant_id: null },
  });
  await prisma.product_images.createMany({
    data: urls.map((url, sort_order) => ({
      product_id: productId,
      url,
      sort_order,
    })),
  });
}
