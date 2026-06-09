import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";

/** Keep batches small — Hostinger/proxy often cuts long requests around ~30s. */
export const BULK_DELETE_CHUNK_SIZE = 10;

export type BulkDeleteProductsClientResult = {
  deleted: string[];
  failed: { id: string; name?: string | null; error: string }[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function bulkDeleteProductsClient(
  ids: string[]
): Promise<BulkDeleteProductsClientResult> {
  const uniqueIds = [...new Set(ids)];
  const deleted: string[] = [];
  const failed: BulkDeleteProductsClientResult["failed"] = [];

  for (const batch of chunk(uniqueIds, BULK_DELETE_CHUNK_SIZE)) {
    const res = await fetchAdminWithRetry("/api/admin/products/bulk-delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: batch }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 503 && data?.code === "TIMEOUT") {
        throw new Error("Bulk delete timed out — select fewer products and try again.");
      }
      throw new Error(data?.error || "Bulk delete failed");
    }

    deleted.push(...((data.deleted ?? []) as string[]));
    failed.push(
      ...((data.failed ?? []) as { id: string; name?: string | null; error: string }[])
    );
  }

  return { deleted, failed };
}

export function formatBulkDeleteFailureToast(
  failed: BulkDeleteProductsClientResult["failed"],
  nameForId: (id: string) => string | null | undefined
): string {
  const active = failed.filter((f) => /active order/i.test(f.error));
  const other = failed.filter((f) => !/active order/i.test(f.error));

  const parts: string[] = [];
  if (active.length > 0) {
    const names = active.map((f) => f.name ?? nameForId(f.id) ?? f.id).slice(0, 4);
    const suffix = active.length > 4 ? `, +${active.length - 4} more` : "";
    parts.push(
      `${active.length} blocked by live orders (refund/cancel those orders first): ${names.join(", ")}${suffix}`
    );
  }
  if (other.length > 0) {
    const names = other.map((f) => f.name ?? nameForId(f.id) ?? f.id).slice(0, 4);
    const suffix = other.length > 4 ? `, +${other.length - 4} more` : "";
    parts.push(`${other.length} could not be deleted: ${names.join(", ")}${suffix}`);
  }
  return parts.join("\n");
}
