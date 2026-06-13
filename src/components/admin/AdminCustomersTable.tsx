"use client";

import { useCallback, useDeferredValue, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";
import type { AdminCustomerRow } from "@/lib/admin/customers";

const PAGE_SIZE = 50;

type ListResponse = {
  customers: AdminCustomerRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function AdminCustomersTable() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searching = query !== deferredQuery;
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ListResponse>({
    customers: [],
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
  });
  const [editing, setEditing] = useState<AdminCustomerRow | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(PAGE_SIZE),
      });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetchAdminWithRetry(`/api/admin/customers?${params.toString()}`);
      const json = (await res.json().catch(() => ({}))) as ListResponse & { error?: string };
      if (!res.ok) throw new Error(json?.error || "Failed to load customers");
      setData({
        customers: Array.isArray(json.customers) ? json.customers : [],
        total: Number(json.total ?? 0),
        page: Number(json.page ?? p),
        limit: Number(json.limit ?? PAGE_SIZE),
        totalPages: Math.max(1, Number(json.totalPages ?? 1)),
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load customers");
      setData((prev) => ({ ...prev, customers: [] }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(deferredQuery, page);
  }, [deferredQuery, page, load]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery]);

  function openEdit(customer: AdminCustomerRow) {
    setEditing(customer);
    setForm({
      name: customer.name ?? "",
      email: customer.displayEmail ?? customer.email,
      phone: customer.phone ?? "",
    });
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetchAdminWithRetry(`/api/admin/customers/${editing.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not save customer");
      toast.success("Customer updated");
      closeEdit();
      void load(deferredQuery, page);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(customer: AdminCustomerRow) {
    if (!customer.displayEmail) {
      toast.error("This customer has no registered email for password reset");
      return;
    }
    const ok = window.confirm(
      `Send a password reset link to ${customer.displayEmail}? They will set a new password on the set-password page.`
    );
    if (!ok) return;
    setResettingId(customer.id);
    try {
      const res = await fetchAdminWithRetry(`/api/admin/customers/${customer.id}/reset-password`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not send reset link");
      toast.success(
        json?.emailSent
          ? `Reset link sent to ${json?.sentTo ?? customer.displayEmail}`
          : "Reset link created (email may be skipped in dev)"
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setResettingId(null);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="block flex-1 max-w-md">
            <span className="sr-only">Search customers</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, or phone…"
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
          <p className="text-sm text-meta-3">
            {searching || loading ? "Searching…" : `${data.total} customer(s)`}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-meta-3 border-b border-gray-3">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Orders</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && data.customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-sm text-meta-3">
                    Loading…
                  </td>
                </tr>
              ) : data.customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-sm text-meta-3">
                    No customers found.
                  </td>
                </tr>
              ) : (
                data.customers.map((c) => (
                  <tr key={c.id} className="border-b border-gray-3 last:border-0">
                    <td className="py-3 px-4">
                      <div className="font-medium text-dark">{c.name?.trim() || "—"}</div>
                      <div className="text-xs text-meta-3">{c.displayEmail ?? c.email}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.googleSignIn ? (
                          <span className="rounded-full bg-blue/10 px-2 py-0.5 text-[10px] font-medium text-blue">
                            Google
                          </span>
                        ) : null}
                        {!c.isActive ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-meta-3">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-dark">{c.phone ?? "—"}</td>
                    <td className="py-3 px-4 text-dark">{c.orderCount}</td>
                    <td className="py-3 px-4 text-xs text-meta-3">{c.createdAtLabel}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-start gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="text-sm font-medium text-blue hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={!c.displayEmail || resettingId === c.id}
                          onClick={() => void handleResetPassword(c)}
                          className="text-sm font-medium text-meta-3 hover:text-dark hover:underline disabled:opacity-50"
                        >
                          {resettingId === c.id ? "Sending…" : "Reset password"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          currentPage={data.page}
          totalPages={data.totalPages}
          pathname="/admin/customers"
          searchQuery={deferredQuery}
          onPageChange={setPage}
        />
      </div>

      {editing ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-dark/40"
            onClick={closeEdit}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-3 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-dark">Edit customer</h2>
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="text-sm font-medium text-meta-3 hover:text-dark disabled:opacity-60"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-xs text-meta-3 break-all">ID: {editing.id}</p>

            <form onSubmit={handleSave} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-dark">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-dark">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-dark">Phone</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="10-digit Indian mobile or leave empty"
                  className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  disabled={saving || !editing.displayEmail || resettingId === editing.id}
                  onClick={() => void handleResetPassword(editing)}
                  className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 transition disabled:opacity-60"
                >
                  {resettingId === editing.id ? "Sending…" : "Send reset password link"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeEdit}
                  className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
