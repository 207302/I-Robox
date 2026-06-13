"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { SavedAddressRecord } from "@/lib/account/savedAddress";

const EMPTY_FORM = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
};

type AddressForm = typeof EMPTY_FORM;

const ADDRESS_FIELDS = [
  ["full_name", "Full name", true],
  ["phone", "Phone", true],
  ["line1", "Address line 1", true],
  ["line2", "Address line 2 (optional)", false],
  ["city", "City", true],
  ["state", "State", true],
  ["postal_code", "Postal code", true],
  ["country", "Country", true],
] as const;

type Props = {
  addresses: SavedAddressRecord[];
};

function addressToForm(addr: SavedAddressRecord): AddressForm {
  return {
    full_name: addr.full_name,
    phone: addr.phone,
    line1: addr.line1,
    line2: addr.line2 ?? "",
    city: addr.city,
    state: addr.state,
    postal_code: addr.postal_code,
    country: addr.country,
  };
}

export default function AccountAddressesCard({ addresses: initialAddresses }: Props) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [primaryLoadingId, setPrimaryLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setAddresses(initialAddresses);
  }, [initialAddresses]);

  function openAddForm() {
    setEditingId(null);
    setShowForm((open) => !open);
    if (!showForm) setForm(EMPTY_FORM);
  }

  function startEdit(addr: SavedAddressRecord) {
    setShowForm(false);
    setEditingId(addr.id);
    setEditForm(addressToForm(addr));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save address");

      const saved = data?.address as SavedAddressRecord | undefined;
      if (saved?.id) {
        setAddresses((prev) => {
          const cleared = saved.isPrimary
            ? prev.map((a) => ({ ...a, isPrimary: false }))
            : prev;
          return [saved, ...cleared];
        });
      } else {
        const listRes = await fetch("/api/account/addresses");
        const listData = await listRes.json().catch(() => ({}));
        if (Array.isArray(listData?.addresses)) {
          setAddresses(listData.addresses as SavedAddressRecord[]);
        }
      }

      toast.success("Address saved");
      setForm(EMPTY_FORM);
      setShowForm(false);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/account/addresses/${editingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update address");

      const saved = data?.address as SavedAddressRecord | undefined;
      if (saved?.id) {
        setAddresses((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
      }
      toast.success("Address updated");
      cancelEdit();
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleSetPrimary(id: string) {
    setPrimaryLoadingId(id);
    try {
      const res = await fetch(`/api/account/addresses/${id}/primary`, {
        method: "PUT",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not set primary address");
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isPrimary: a.id === id }))
      );
      toast.success("Primary address updated");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setPrimaryLoadingId(null);
    }
  }

  function renderAddressFields(
    value: AddressForm,
    onChange: (next: AddressForm) => void,
    idPrefix: string
  ) {
    return ADDRESS_FIELDS.map(([key, label, required]) => (
      <label key={`${idPrefix}-${key}`} className="block">
        <span className="mb-1 block text-sm font-medium text-dark">{label}</span>
        <input
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          required={required}
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
        />
      </label>
    ));
  }

  return (
    <aside className="h-fit rounded-2xl border border-gray-3 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-dark">Addresses</h2>
        <button
          type="button"
          onClick={openAddForm}
          className="text-sm font-medium text-blue hover:underline"
        >
          {showForm ? "Cancel" : "Add address"}
        </button>
      </div>

      {addresses.length === 0 ? (
        <p className="mt-3 text-sm text-meta-3">No saved addresses yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {addresses.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-4 ${
                a.isPrimary ? "border-blue bg-blue/5" : "border-gray-3"
              }`}
            >
              {editingId === a.id ? (
                <form onSubmit={handleEditSubmit} className="space-y-3">
                  {renderAddressFields(editForm, setEditForm, a.id)}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="inline-flex rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
                    >
                      {editLoading ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      disabled={editLoading}
                      onClick={cancelEdit}
                      className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-dark">{a.full_name}</span>
                      {a.isPrimary ? (
                        <span className="rounded-full bg-blue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-meta-3">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.postal_code}
                    </div>
                    <div className="mt-1 text-sm text-meta-3">{a.phone}</div>
                    <div className="mt-1 text-sm text-meta-3">{a.country}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="text-sm font-medium text-blue hover:underline"
                    >
                      Edit
                    </button>
                    {!a.isPrimary ? (
                      <button
                        type="button"
                        disabled={primaryLoadingId === a.id}
                        onClick={() => handleSetPrimary(a.id)}
                        className="text-sm font-medium text-blue hover:underline disabled:opacity-60"
                      >
                        {primaryLoadingId === a.id ? "Saving…" : "Set primary"}
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-gray-3 pt-4">
          {renderAddressFields(form, setForm, "new")}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full justify-center rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save address"}
          </button>
        </form>
      ) : null}
    </aside>
  );
}
