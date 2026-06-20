"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";

export type NotifySignupRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
};

async function downloadAdminFile(url: string, fallbackFilename: string) {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Download failed");
  }
  const cd = res.headers.get("Content-Disposition");
  const m =
    cd?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i) ?? cd?.match(/filename="([^"]+)"/);
  const filename = m?.[1]?.trim() || fallbackFilename;
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

function formatSignupDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

async function parseAdminJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Request failed");
  }
  return data as T;
}

type Props = {
  /** When false, parent must call refresh via key remount or navigate here. Default true. */
  loadOnMount?: boolean;
  compact?: boolean;
};

export default function ShopPopupSignupsPanel({ loadOnMount = true, compact = false }: Props) {
  const [rows, setRows] = useState<NotifySignupRow[]>([]);
  const [loading, setLoading] = useState(loadOnMount);
  const [exporting, setExporting] = useState(false);

  async function loadSignups() {
    setLoading(true);
    try {
      const data = await parseAdminJson<{ items: NotifySignupRow[] }>(
        await fetchAdminWithRetry("/api/admin/marketing/notify-signups", { cache: "no-store" })
      );
      setRows(data.items ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load signups");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loadOnMount) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await parseAdminJson<{ items: NotifySignupRow[] }>(
          await fetchAdminWithRetry("/api/admin/marketing/notify-signups", { cache: "no-store" })
        );
        if (!cancelled) setRows(data.items ?? []);
      } catch (err: unknown) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load signups");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOnMount]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`font-semibold text-dark ${compact ? "text-base" : "text-lg"}`}>
            Latest drop signups
          </h2>
          <p className="mt-1 text-sm text-meta-3">
            Enquiries from the &quot;Notify me&quot; popup on{" "}
            <span className="font-medium text-dark">/shop</span>. Same email updates name and mobile.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 disabled:opacity-60"
            onClick={() => void loadSignups().then(() => toast.success("List refreshed"))}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            disabled={exporting || rows.length === 0}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark disabled:opacity-60"
            onClick={async () => {
              setExporting(true);
              try {
                const date = new Date().toISOString().slice(0, 10);
                await downloadAdminFile(
                  "/api/admin/marketing/notify-signups/export",
                  `latest-drop-signups-${date}.xlsx`
                );
                toast.success("Excel download started");
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Export failed");
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? "Exporting…" : "Download Excel"}
          </button>
        </div>
      </div>

      <p className="text-sm text-meta-3">
        <span className="font-semibold text-dark">{rows.length}</span> signup
        {rows.length === 1 ? "" : "s"}
      </p>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-meta-3">Loading signups…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-3 bg-gray-1/40 px-4 py-8 text-center text-sm text-meta-3">
          No signups yet. They appear when visitors submit the popup on the shop page.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-3">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-1 text-left text-meta-3">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-3">
              {rows.map((row) => (
                <tr key={row.id} className="text-dark">
                  <td className="px-4 py-3 font-medium">{row.full_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.phone}</td>
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-meta-3">
                    {formatSignupDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-meta-3">
                    {formatSignupDate(row.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
