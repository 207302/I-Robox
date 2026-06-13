"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

type Props = {
  initialPhone: string | null;
};

export default function AccountPhoneCard({ initialPhone }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(!initialPhone);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) {
      toast.error("Enter a mobile number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/phone", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update phone");
      toast.success(initialPhone ? "Phone updated" : "Phone added");
      setPhone(typeof data?.phone === "string" ? data.phone : trimmed);
      setEditing(false);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setPhone(initialPhone ?? "");
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-dark">Mobile number</h2>
        {!editing && initialPhone ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-blue hover:underline"
          >
            Edit
          </button>
        ) : null}
      </div>

      {!editing ? (
        <p className="mt-3 text-sm font-medium text-dark">{initialPhone ?? "Not added yet"}</p>
      ) : (
        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Mobile number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9961042506"
              inputMode="tel"
              autoComplete="tel"
              required
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
            <span className="mt-1 block text-xs text-meta-4">
              Must not already be linked to another account.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
            >
              {loading ? "Saving…" : initialPhone ? "Save changes" : "Add number"}
            </button>
            {initialPhone ? (
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
