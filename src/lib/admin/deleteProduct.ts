import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function cloudinaryPublicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = "/upload/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    let tail = u.pathname.slice(idx + marker.length);
    tail = tail.replace(/^([^/]+\/)*v\d+\//, "");
    if (!tail) return null;
    return tail.replace(/\.[^.\/]+$/, "");
  } catch {
    return null;
  }
}

export type DeleteProductResult =
  | { ok: true; slug: string; cloudinaryPublicIds: string[] }
  | { ok: false; status: 404 | 409; error: string; name?: string | null };

export async function deleteProductById(id: string): Promise<DeleteProductResult> {
  const productBeforeDelete = await prisma.products.findUnique({
    where: { id },
    select: { slug: true, name: true },
  });
  if (!productBeforeDelete) {
    return { ok: false, status: 404, error: "Product not found" };
  }

  const imageRows = await prisma.product_images.findMany({
    where: { product_id: id },
    select: { url: true },
  });

  const [orderItemsCount, activeOrderRefsCount, reviewsCount, returnsCount] = await Promise.all([
    prisma.order_items.count({ where: { product_id: id } }),
    prisma.order_items.count({
      where: {
        product_id: id,
        orders: {
          status: {
            in: ["PENDING", "CONFIRMED", "SHIPPED", "RETURN_REQUESTED", "RETURN_APPROVED"],
          },
        },
      },
    }),
    prisma.reviews.count({ where: { product_id: id } }),
    prisma.returns.count({
      where: {
        order_items: {
          product_id: id,
        },
      },
    }),
  ]);

  if (orderItemsCount > 0 || reviewsCount > 0 || returnsCount > 0) {
    const reasonParts: string[] = [];
    if (activeOrderRefsCount > 0) reasonParts.push(`${activeOrderRefsCount} active/pending order item(s)`);
    if (orderItemsCount > 0) reasonParts.push(`${orderItemsCount} total historical order item(s)`);
    if (reviewsCount > 0) reasonParts.push(`${reviewsCount} review(s)`);
    if (returnsCount > 0) reasonParts.push(`${returnsCount} return record(s)`);
    return {
      ok: false,
      status: 409,
      error: `Referenced by ${reasonParts.join(", ")}. Set inactive instead.`,
      name: productBeforeDelete.name,
    };
  }

  try {
    await prisma.products.delete({ where: { id } });
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2003") {
      return {
        ok: false,
        status: 409,
        error: "Has order/review references. Set inactive instead.",
        name: productBeforeDelete.name,
      };
    }
    throw e;
  }

  const cloudinaryPublicIds = imageRows
    .map((r) => cloudinaryPublicIdFromUrl(r.url))
    .filter((v): v is string => Boolean(v));

  return { ok: true, slug: productBeforeDelete.slug, cloudinaryPublicIds };
}

export function destroyCloudinaryImages(publicIds: string[]) {
  const unique = [...new Set(publicIds.filter(Boolean))];
  if (unique.length === 0) return;
  cloudinary.api.delete_resources(unique, { resource_type: "image" }).catch(() => {});
}

function blockerMessage(input: {
  orderItems?: number;
  reviews?: number;
  returns?: number;
}): string {
  const parts: string[] = [];
  if (input.orderItems) parts.push(`${input.orderItems} order item(s)`);
  if (input.reviews) parts.push(`${input.reviews} review(s)`);
  if (input.returns) parts.push(`${input.returns} return record(s)`);
  return `Referenced by ${parts.join(", ")}. Set inactive instead.`;
}

/** Fast path for bulk delete: batched reference checks + deleteMany. */
export async function bulkDeleteProductsByIds(ids: string[]): Promise<{
  deleted: { id: string; slug: string; cloudinaryPublicIds: string[] }[];
  failed: { id: string; name: string | null; error: string }[];
}> {
  const uniqueIds = [...new Set(ids)];
  const deleted: { id: string; slug: string; cloudinaryPublicIds: string[] }[] = [];
  const failed: { id: string; name: string | null; error: string }[] = [];

  if (uniqueIds.length === 0) return { deleted, failed };

  const [products, images, orderRefs, reviewRefs, returnRefs] = await Promise.all([
    prisma.products.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, slug: true, name: true },
    }),
    prisma.product_images.findMany({
      where: { product_id: { in: uniqueIds } },
      select: { product_id: true, url: true },
    }),
    prisma.order_items.groupBy({
      by: ["product_id"],
      where: { product_id: { in: uniqueIds } },
      _count: { _all: true },
    }),
    prisma.reviews.groupBy({
      by: ["product_id"],
      where: { product_id: { in: uniqueIds } },
      _count: { _all: true },
    }),
    prisma.order_items.groupBy({
      by: ["product_id"],
      where: {
        product_id: { in: uniqueIds },
        returns: { some: {} },
      },
      _count: { _all: true },
    }),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const orderCounts = new Map(orderRefs.map((r) => [r.product_id, r._count._all]));
  const reviewCounts = new Map(reviewRefs.map((r) => [r.product_id, r._count._all]));
  const returnCounts = new Map(returnRefs.map((r) => [r.product_id, r._count._all]));

  const imagesByProduct = new Map<string, string[]>();
  for (const img of images) {
    const list = imagesByProduct.get(img.product_id) ?? [];
    list.push(img.url);
    imagesByProduct.set(img.product_id, list);
  }

  const deletableIds: string[] = [];

  for (const id of uniqueIds) {
    const product = productById.get(id);
    if (!product) {
      failed.push({ id, name: null, error: "Product not found" });
      continue;
    }

    const orderItems = orderCounts.get(id) ?? 0;
    const reviews = reviewCounts.get(id) ?? 0;
    const returns = returnCounts.get(id) ?? 0;

    if (orderItems > 0 || reviews > 0 || returns > 0) {
      failed.push({
        id,
        name: product.name,
        error: blockerMessage({ orderItems, reviews, returns }),
      });
      continue;
    }

    deletableIds.push(id);
  }

  if (deletableIds.length > 0) {
    await prisma.products.deleteMany({ where: { id: { in: deletableIds } } });

    for (const id of deletableIds) {
      const product = productById.get(id)!;
      const urls = imagesByProduct.get(id) ?? [];
      const cloudinaryPublicIds = urls
        .map((url) => cloudinaryPublicIdFromUrl(url))
        .filter((v): v is string => Boolean(v));
      deleted.push({ id, slug: product.slug, cloudinaryPublicIds });
    }
  }

  return { deleted, failed };
}
