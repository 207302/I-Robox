import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";

export const BULK_INACTIVE_CHUNK_SIZE = 50;

export type BulkInactiveProductsClientResult = {
  inactivated: string[];
  failed: { id: string; name?: string | null; error: string }[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function bulkInactiveProductsClient(
  ids: string[]
): Promise<BulkInactiveProductsClientResult> {
  const uniqueIds = [...new Set(ids)];
  const inactivated: string[] = [];
  const failed: BulkInactiveProductsClientResult["failed"] = [];

  for (const batch of chunk(uniqueIds, BULK_INACTIVE_CHUNK_SIZE)) {
    const res = await fetchAdminWithRetry("/api/admin/products/bulk-inactive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: batch }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 503 && data?.code === "TIMEOUT") {
        throw new Error("Bulk inactive timed out — select fewer products and try again.");
      }
      throw new Error(data?.error || "Bulk inactive failed");
    }

    inactivated.push(...((data.inactivated ?? []) as string[]));
    failed.push(
      ...((data.failed ?? []) as { id: string; name?: string | null; error: string }[])
    );
  }

  return { inactivated, failed };
}
