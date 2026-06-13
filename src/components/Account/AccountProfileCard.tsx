"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

type Props = {
  initialName: string | null;
  initialEmail: string | null;
  emailManagedByGoogle: boolean;
};

export default function AccountProfileCard({
  initialName,
  initialEmail,
  emailManagedByGoogle,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter your name");
      return;
    }
    setNameLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update name");
      setName(typeof data?.name === "string" ? data.name : trimmed);
      setEditingName(false);
      toast.success("Name updated");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setNameLoading(false);
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter your email");
      return;
    }
    setEmailLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update email");
      setEmail(typeof data?.email === "string" ? data.email : trimmed);
      setEditingEmail(false);
      toast.success(initialEmail ? "Email updated" : "Email added");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-6">
      <h2 className="text-lg font-semibold text-dark">Profile</h2>

      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-gray-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-meta-3">Name</span>
            {!editingName ? (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-sm font-medium text-blue hover:underline"
              >
                Edit
              </button>
            ) : null}
          </div>
          {!editingName ? (
            <p className="mt-2 text-sm font-medium text-dark">{name.trim() || "—"}</p>
          ) : (
            <form onSubmit={saveName} className="mt-3 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={nameLoading}
                  className="inline-flex rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
                >
                  {nameLoading ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={nameLoading}
                  onClick={() => {
                    setName(initialName ?? "");
                    setEditingName(false);
                  }}
                  className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-gray-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-meta-3">Email</span>
            {!editingEmail && !emailManagedByGoogle ? (
              <button
                type="button"
                onClick={() => setEditingEmail(true)}
                className="text-sm font-medium text-blue hover:underline"
              >
                {initialEmail ? "Edit" : "Add"}
              </button>
            ) : null}
          </div>
          {emailManagedByGoogle ? (
            <>
              <p className="mt-2 text-sm font-medium text-dark">{initialEmail ?? "—"}</p>
              <p className="mt-1 text-xs text-meta-4">Managed by Google sign-in.</p>
            </>
          ) : !editingEmail ? (
            <p className="mt-2 text-sm font-medium text-dark">{email.trim() || "—"}</p>
          ) : (
            <form onSubmit={saveEmail} className="mt-3 space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. name@gmail.com"
                required
                className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              />
              <span className="block text-xs text-meta-4">
                Use Gmail, Yahoo, Outlook, or another common provider.
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="inline-flex rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
                >
                  {emailLoading ? "Saving…" : initialEmail ? "Save" : "Add email"}
                </button>
                {initialEmail ? (
                  <button
                    type="button"
                    disabled={emailLoading}
                    onClick={() => {
                      setEmail(initialEmail ?? "");
                      setEditingEmail(false);
                    }}
                    className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
