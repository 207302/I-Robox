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

type BroadcastPreview = {
  productCount: number;
  products: { name: string; priceLabel: string; productUrl: string }[];
};

type BroadcastFailure = {
  email: string;
  name: string;
  error: string;
};

type BroadcastResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  message?: string;
  smtpError?: string;
  recipients?: number;
  sent?: number;
  failed?: number;
  failures?: BroadcastFailure[];
  notAttempted?: BroadcastFailure[];
  productCount?: number;
  offset?: number;
  nextOffset?: number;
  remaining?: number;
  done?: boolean;
};

const BROADCAST_BATCH_SIZE = 40;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default function ShopPopupSignupsPanel({ loadOnMount = true, compact = false }: Props) {
  const [rows, setRows] = useState<NotifySignupRow[]>([]);
  const [loading, setLoading] = useState(loadOnMount);
  const [exporting, setExporting] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastBroadcastFailures, setLastBroadcastFailures] = useState<{
    sent: number;
    recipients: number;
    failures: BroadcastFailure[];
    notAttempted: BroadcastFailure[];
    smtpError?: string;
  } | null>(null);

  async function handleDelete(row: NotifySignupRow) {
    const confirmed = window.confirm(
      `Delete signup for ${row.full_name} (${row.email})? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    try {
      await parseAdminJson<{ ok: boolean }>(
        await fetchAdminWithRetry(`/api/admin/marketing/notify-signups/${row.id}`, {
          method: "DELETE",
          credentials: "include",
        })
      );
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("Signup deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not delete signup");
    } finally {
      setDeletingId(null);
    }
  }

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
            disabled={broadcasting || rows.length === 0}
            className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 disabled:opacity-60"
            onClick={async () => {
              setBroadcasting(true);
              try {
                const preview = await parseAdminJson<BroadcastPreview>(
                  await fetchAdminWithRetry(
                    "/api/admin/marketing/notify-signups/broadcast",
                    { cache: "no-store" }
                  )
                );
                if (preview.productCount === 0) {
                  toast.error("No active products to feature — add products first.");
                  return;
                }
                const productList = preview.products.map((p) => `• ${p.name}`).join("\n");
                const confirmed = window.confirm(
                  `Send latest-drops email to all ${rows.length} signup${rows.length === 1 ? "" : "s"}?\n\n` +
                    `The email will include ${preview.productCount} newest products:\n${productList}\n\n` +
                    "Plus a link to the shop page. Product list is fetched fresh at send time."
                );
                if (!confirmed) return;

                let offset = 0;
                let totalSent = 0;
                const allFailures: BroadcastFailure[] = [];
                let recipients = rows.length;
                let lastSmtpError: string | undefined;
                let stopped = false;

                while (!stopped) {
                  setBroadcastProgress(
                    totalSent === 0
                      ? `Sending batch…`
                      : `Sent ${totalSent} of ${recipients}…`
                  );
                  const result = await parseAdminJson<BroadcastResult>(
                    await fetch("/api/admin/marketing/notify-signups/broadcast", {
                      method: "POST",
                      credentials: "include",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ offset, limit: BROADCAST_BATCH_SIZE }),
                    })
                  );
                  if (result.skipped) {
                    const failures = result.failures ?? [];
                    const notAttempted = result.notAttempted ?? [];
                    if (failures.length > 0 || notAttempted.length > 0 || totalSent > 0) {
                      setLastBroadcastFailures({
                        sent: totalSent,
                        recipients,
                        failures: [...allFailures, ...failures],
                        notAttempted,
                        smtpError: result.message,
                      });
                    } else {
                      setLastBroadcastFailures(null);
                    }
                    const msg =
                      result.reason === "smtp_not_configured"
                        ? "SMTP not configured — set EMAIL_SERVER_* on the server."
                        : result.reason === "smtp_blocked"
                          ? result.message ||
                            "SMTP blocked by your email host. Enable outbound mail in Hostinger hPanel or use Gmail SMTP."
                          : result.reason === "no_products"
                            ? "No active products to feature."
                            : "No signups to email.";
                    toast.error(msg);
                    stopped = true;
                    break;
                  }

                  recipients = result.recipients ?? recipients;
                  totalSent += result.sent ?? 0;
                  allFailures.push(...(result.failures ?? []));
                  lastSmtpError = result.smtpError;
                  offset = result.nextOffset ?? offset + BROADCAST_BATCH_SIZE;

                  if (result.done) break;
                  if ((result.nextOffset ?? offset) <= offset) break;
                  await sleep(result.smtpError ? 8000 : 2000);
                }

                if (!stopped) {
                  if (allFailures.length > 0) {
                    setLastBroadcastFailures({
                      sent: totalSent,
                      recipients,
                      failures: allFailures,
                      notAttempted: [],
                      smtpError: lastSmtpError,
                    });
                  } else {
                    setLastBroadcastFailures(null);
                  }

                  if (allFailures.length > 0) {
                    toast.error(
                      `Sent to ${totalSent} of ${recipients} (${allFailures.length} failed — see list below)`
                    );
                  } else {
                    toast.success(`Sent to ${totalSent} of ${recipients}`);
                  }
                }
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Bulk email failed");
              } finally {
                setBroadcasting(false);
                setBroadcastProgress(null);
              }
            }}
          >
            {broadcasting ? broadcastProgress || "Sending…" : "Send bulk email"}
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

      {lastBroadcastFailures ? (
        <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-red-800">
                Bulk email failures
              </h3>
              <p className="mt-1 text-sm text-red-700/90">
                Sent {lastBroadcastFailures.sent} of {lastBroadcastFailures.recipients}.
                {lastBroadcastFailures.failures.length > 0
                  ? ` ${lastBroadcastFailures.failures.length} failed.`
                  : ""}
                {lastBroadcastFailures.notAttempted.length > 0
                  ? ` ${lastBroadcastFailures.notAttempted.length} not attempted.`
                  : ""}
                {lastBroadcastFailures.smtpError
                  ? ` ${lastBroadcastFailures.smtpError}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-dark hover:bg-gray-1"
                onClick={async () => {
                  const emails = [
                    ...lastBroadcastFailures.failures.map((f) => f.email),
                    ...lastBroadcastFailures.notAttempted.map((f) => f.email),
                  ];
                  try {
                    await navigator.clipboard.writeText(emails.join("\n"));
                    toast.success("Failed emails copied");
                  } catch {
                    toast.error("Could not copy to clipboard");
                  }
                }}
              >
                Copy emails
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-dark hover:bg-gray-1"
                onClick={() => setLastBroadcastFailures(null)}
              >
                Dismiss
              </button>
            </div>
          </div>

          {lastBroadcastFailures.failures.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-red-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50 text-left text-red-800/80">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {lastBroadcastFailures.failures.map((f) => (
                    <tr key={`fail-${f.email}`} className="text-dark">
                      <td className="px-3 py-2 font-medium">{f.name || "—"}</td>
                      <td className="px-3 py-2">{f.email}</td>
                      <td className="px-3 py-2 text-meta-3">{f.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {lastBroadcastFailures.notAttempted.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-800/70">
                Not attempted (send stopped)
              </p>
              <div className="overflow-x-auto rounded-lg border border-red-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-red-50 text-left text-red-800/80">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {lastBroadcastFailures.notAttempted.map((f) => (
                      <tr key={`skip-${f.email}`} className="text-dark">
                        <td className="px-3 py-2 font-medium">{f.name || "—"}</td>
                        <td className="px-3 py-2">{f.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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
                <th className="px-4 py-3 font-medium text-right">Actions</th>
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
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={deletingId === row.id}
                      onClick={() => void handleDelete(row)}
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
                    >
                      {deletingId === row.id ? "Deleting…" : "Delete"}
                    </button>
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
