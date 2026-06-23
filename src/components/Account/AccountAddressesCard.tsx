"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { SavedAddressRecord } from "@/lib/account/savedAddress";
import {
  indianMobileErrorMessage,
  sanitizeIndianPhoneInput,
} from "@/lib/auth/indianMobile";
import {
  getShippingAddressValidationError,
  sanitizeIndianPinInput,
} from "@/lib/validation/address";

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
  ["postal_code", "PIN code", true],
  ["country", "Country", true],
] as const;

type AddressModalState =
  | { mode: "add" }
  | { mode: "edit"; id: string }
  | null;

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
  const [modal, setModal] = useState<AddressModalState>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [primaryLoadingId, setPrimaryLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setAddresses(initialAddresses);
  }, [initialAddresses]);

  useEffect(() => {
    if (!modal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) closeModal();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modal, saving]);

  function openAddModal() {
    setForm(EMPTY_FORM);
    setModal({ mode: "add" });
  }

  function openEditModal(addr: SavedAddressRecord) {
    setForm(addressToForm(addr));
    setModal({ mode: "edit", id: addr.id });
  }

  function closeModal() {
    if (saving) return;
    setModal(null);
    setForm(EMPTY_FORM);
  }

  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;

    const validationError = getShippingAddressValidationError(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const isEdit = modal.mode === "edit";
      const res = await fetch(
        isEdit ? `/api/account/addresses/${modal.id}` : "/api/account/addresses",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || (isEdit ? "Could not update address" : "Could not save address"));
      }

      const saved = data?.address as SavedAddressRecord | undefined;
      if (saved?.id) {
        if (isEdit) {
          setAddresses((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
        } else {
          setAddresses((prev) => {
            const cleared = saved.isPrimary
              ? prev.map((a) => ({ ...a, isPrimary: false }))
              : prev;
            return [saved, ...cleared];
          });
        }
      } else if (!isEdit) {
        const listRes = await fetch("/api/account/addresses");
        const listData = await listRes.json().catch(() => ({}));
        if (Array.isArray(listData?.addresses)) {
          setAddresses(listData.addresses as SavedAddressRecord[]);
        }
      }

      toast.success(isEdit ? "Address updated" : "Address saved");
      closeModal();
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(addr: SavedAddressRecord) {
    const ok = window.confirm(`Delete address for ${addr.full_name}? This cannot be undone.`);
    if (!ok) return;
    setDeletingId(addr.id);
    try {
      const res = await fetch(`/api/account/addresses/${addr.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not delete address");

      const listRes = await fetch("/api/account/addresses");
      const listData = await listRes.json().catch(() => ({}));
      if (Array.isArray(listData?.addresses)) {
        setAddresses(listData.addresses as SavedAddressRecord[]);
      } else {
        setAddresses((prev) => prev.filter((a) => a.id !== addr.id));
      }

      toast.success("Address deleted");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setDeletingId(null);
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

  function renderAddressFields() {
    return ADDRESS_FIELDS.map(([key, label, required]) => (
      <label key={key} className="block">
        <span className="mb-1 block text-sm font-medium text-dark">{label}</span>
        <input
          type={key === "phone" || key === "postal_code" ? "tel" : "text"}
          inputMode={key === "phone" || key === "postal_code" ? "numeric" : undefined}
          maxLength={key === "phone" ? 10 : key === "postal_code" ? 6 : undefined}
          pattern={key === "phone" ? "[6-9][0-9]{9}" : undefined}
          title={
            key === "phone"
              ? indianMobileErrorMessage()
              : key === "postal_code"
                ? "Enter a valid 6-digit Indian PIN code"
                : undefined
          }
          value={form[key]}
          onChange={(e) => {
            const raw = e.target.value;
            const next =
              key === "phone"
                ? sanitizeIndianPhoneInput(raw)
                : key === "postal_code"
                  ? sanitizeIndianPinInput(raw)
                  : raw;
            setForm((f) => ({ ...f, [key]: next }));
          }}
          required={required}
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
        />
      </label>
    ));
  }

  return (
    <>
      <aside className="h-fit rounded-2xl border border-gray-3 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-dark">Addresses</h2>
          <button
            type="button"
            onClick={openAddModal}
            className="text-sm font-medium text-blue hover:underline"
          >
            Add address
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
                      onClick={() => openEditModal(a)}
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
                    <button
                      type="button"
                      disabled={deletingId === a.id}
                      onClick={() => void handleDelete(a)}
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
                    >
                      {deletingId === a.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {modal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="address-modal-title"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-dark/40"
            onClick={closeModal}
          />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-3 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="address-modal-title" className="text-lg font-semibold text-dark">
                {modal.mode === "add" ? "Add address" : "Edit address"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="text-sm font-medium text-meta-3 hover:text-dark disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="mt-4 space-y-3">
              {renderAddressFields()}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
                >
                  {saving ? "Saving…" : modal.mode === "add" ? "Save address" : "Save changes"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
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
