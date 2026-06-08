import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";
import { TERMINAL_ORDER_STATUSES } from "@/lib/inventory/orderInventoryRestore";

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

async function cleanupTerminalOrderRefsForProduct(
  tx: Prisma.TransactionClient,
  productId: string
) {
  const terminalItems = await tx.order_items.findMany({
    where: {
      product_id: productId,
      orders: { status: { in: [...TERMINAL_ORDER_STATUSES] } },
    },
    select: { id: true, order_id: true },
  });

  if (terminalItems.length === 0) return;

  const orderItemIds = terminalItems.map((item) => item.id);
  const orderIds = [...new Set(terminalItems.map((item) => item.order_id))];

  await tx.returns.deleteMany({ where: { order_item_id: { in: orderItemIds } } });
  await tx.order_items.deleteMany({ where: { id: { in: orderItemIds } } });

  for (const orderId of orderIds) {
    const remaining = await tx.order_items.count({ where: { order_id: orderId } });
    if (remaining === 0) {
      await tx.coupon_usages.deleteMany({ where: { order_id: orderId } });
      await tx.orders.delete({ where: { id: orderId } });
    }
  }
}

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

  const activeOrderItemsCount = await prisma.order_items.count({
    where: {
      product_id: id,
      orders: { status: { notIn: [...TERMINAL_ORDER_STATUSES] } },
    },
  });

  if (activeOrderItemsCount > 0) {
    return {
      ok: false,
      status: 409,
      error: `Referenced by ${activeOrderItemsCount} active order item(s). Mark related orders refunded or set inactive instead.`,
      name: productBeforeDelete.name,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await cleanupTerminalOrderRefsForProduct(tx, id);
      await tx.products.delete({ where: { id } });
    });
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2003") {
      return {
        ok: false,
        status: 409,
        error: "Has active order references. Set inactive instead.",
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

function blockerMessage(activeOrderItems: number): string {
  return `Referenced by ${activeOrderItems} active order item(s). Mark related orders refunded or set inactive instead.`;
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

  const [products, images, activeOrderRefs] = await Promise.all([
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
      where: {
        product_id: { in: uniqueIds },
        orders: { status: { notIn: [...TERMINAL_ORDER_STATUSES] } },
      },
      _count: { _all: true },
    }),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const activeOrderCounts = new Map(activeOrderRefs.map((r) => [r.product_id, r._count._all]));

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

    const activeOrderItems = activeOrderCounts.get(id) ?? 0;
    if (activeOrderItems > 0) {
      failed.push({
        id,
        name: product.name,
        error: blockerMessage(activeOrderItems),
      });
      continue;
    }

    deletableIds.push(id);
  }

  if (deletableIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const id of deletableIds) {
        await cleanupTerminalOrderRefsForProduct(tx, id);
      }
      await tx.products.deleteMany({ where: { id: { in: deletableIds } } });
    });

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
