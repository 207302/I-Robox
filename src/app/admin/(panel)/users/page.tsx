"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import PasswordInput from "@/components/Auth/PasswordInput";
import {
  validateEmailAddress,
  validatePassword,
} from "@/lib/validation/rules";

const ROLES = ["SUPER_ADMIN", "MANAGER", "STAFF", "SUPPORT"] as const;
type AdminRole = (typeof ROLES)[number];

const ROLE_BADGE: Record<AdminRole, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  MANAGER:     "bg-blue-100 text-blue-700",
  STAFF:       "bg-green-100 text-green-700",
  SUPPORT:     "bg-yellow-100 text-yellow-700",
};

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  is_active: boolean;
  roles: string[];
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "STAFF" as AdminRole,
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json().catch(() => []);
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const emailResult = validateEmailAddress(form.email, { commonProviderOnly: false });
    const passwordResult = validatePassword(form.password);
    if (!emailResult.ok) {
      toast.error(emailResult.error);
      return;
    }
    if (!passwordResult.ok) {
      toast.error(passwordResult.error);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to create user");
      toast.success(`Admin created: ${data.email}`);
      setCreating(false);
      setForm({ name: "", email: "", password: "", role: "STAFF" });
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(user: AdminUser) {
    if (!confirm(`Remove admin access for ${user.email}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/users?id=${user.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(data?.error || "Failed"); return; }
    toast.success("Admin removed");
    load();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-dark">Admin users</h1>
          <p className="mt-0.5 text-sm text-meta-3">Only SUPER_ADMIN can manage this list.</p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition"
        >
          {creating ? "Cancel" : "+ New admin"}
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={create} className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-dark">Create admin account</h2>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Full name (optional)</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Email <span className="text-red-500">*</span></span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Password <span className="text-red-500">*</span></span>
            <PasswordInput
              required
              value={form.password}
              onChange={(password) => setForm((f) => ({ ...f, password }))}
              placeholder="Min 8 characters"
              minLength={8}
              autoComplete="new-password"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AdminRole }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <span className="mt-1 block text-xs text-meta-4">
              SUPER_ADMIN = full access · MANAGER = products/orders/coupons · STAFF = read + basic edits · SUPPORT = orders/reviews
            </span>
          </label>

          <button
            disabled={saving}
            className="rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create admin"}
          </button>
        </form>
      )}

      {/* Users table */}
      <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta-3 border-b border-gray-3">
              <th className="py-3 px-4">Name / Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-6 px-4 text-sm text-meta-3">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="py-6 px-4 text-sm text-meta-3">No admin users found.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-gray-3 last:border-0">
                <td className="py-3 px-4">
                  {u.name && <div className="font-medium text-dark">{u.name}</div>}
                  <div className="text-xs text-meta-3">{u.email}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span key={r} className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[r as AdminRole] ?? "bg-gray-100 text-gray-700"}`}>
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-3 px-4 text-meta-3 text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => remove(u)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 transition"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
