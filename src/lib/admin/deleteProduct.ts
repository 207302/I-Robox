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
  | { ok: false; status: 404 | 409; error: string };

export async function deleteProductById(id: string): Promise<DeleteProductResult> {
  const productBeforeDelete = await prisma.products.findUnique({
    where: { id },
    select: { slug: true },
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
