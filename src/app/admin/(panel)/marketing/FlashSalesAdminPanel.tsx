"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { AdminCouponScopeFields } from "@/components/admin/AdminCouponScopeFields";
import { formatFlashDiscount } from "@/lib/pricing/flashSaleTypes";
import type { FlashDiscountType } from "@/lib/pricing/flashSaleTypes";

type FlashSaleRow = {
  id: string;
  name: string | null;
  sale_tag: string | null;
  limit_one_per_customer: boolean;
  discount_type: FlashDiscountType;
  discount_value: number;
  is_active: boolean;
  product_ids: string[];
  category_ids: string[];
  brand_ids: string[];
  products: { id: string; name: string; slug: string }[];
  categories: { id: string; name: string; slug: string }[];
  brands: { id: string; name: string; slug: string }[];
};

type Props = {
  flashSales: FlashSaleRow[];
  setFlashSales: React.Dispatch<React.SetStateAction<FlashSaleRow[]>>;
  categories: { id: string; name: string; slug: string }[];
  brands: { id: string; name: string; slug: string }[];
  refreshFlash: () => Promise<void>;
  marketingSelectAllBar: (label: string) => React.ReactNode;
  marketingRowCheckbox: (id: string, label: string) => React.ReactNode;
  j: (res: Response) => Promise<any>;
};

function scopeSummary(row: FlashSaleRow): string {
  const parts: string[] = [];
  if (row.products.length) parts.push(`${row.products.length} product${row.products.length === 1 ? "" : "s"}`);
  if (row.categories.length) parts.push(`${row.categories.length} categor${row.categories.length === 1 ? "y" : "ies"}`);
  if (row.brands.length) parts.push(`${row.brands.length} brand${row.brands.length === 1 ? "" : "s"}`);
  return parts.join(" · ") || "No scope";
}

const emptyForm = {
  name: "",
  sale_tag: "",
  limit_one_per_customer: false,
  discount_type: "FIXED" as FlashDiscountType,
  discount_value: "",
  is_active: true,
  product_ids: [] as string[],
  category_ids: [] as string[],
  brand_ids: [] as string[],
};

export default function FlashSalesAdminPanel({
  flashSales,
  setFlashSales,
  categories,
  brands,
  refreshFlash,
  marketingSelectAllBar,
  marketingRowCheckbox,
  j,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function startEdit(row: FlashSaleRow) {
    setEditingId(row.id);
    setForm({
      name: row.name ?? "",
      sale_tag: row.sale_tag ?? "",
      limit_one_per_customer: row.limit_one_per_customer,
      discount_type: row.discount_type,
      discount_value: String(row.discount_value),
      is_active: row.is_active,
      product_ids: row.product_ids,
      category_ids: row.category_ids,
      brand_ids: row.brand_ids,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveRule() {
    const discount_value = Number(form.discount_value);
    if (!Number.isFinite(discount_value) || discount_value <= 0) {
      toast.error("Enter a valid discount value");
      return;
    }
    if (
      form.product_ids.length === 0 &&
      form.category_ids.length === 0 &&
      form.brand_ids.length === 0
    ) {
      toast.error("Select at least one product, category, or brand");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim() || null,
        sale_tag: form.limit_one_per_customer ? form.sale_tag.trim() || null : null,
        limit_one_per_customer: form.limit_one_per_customer,
        discount_type: form.discount_type,
        discount_value,
        is_active: form.is_active,
        product_ids: form.product_ids,
        category_ids: form.category_ids,
        brand_ids: form.brand_ids,
      };

      const res = editingId
        ? await fetch(`/api/admin/marketing/flash-sales/${editingId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/marketing/flash-sales", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });

      const saved = await j(res);
      toast.success(editingId ? "Flash sale updated" : "Flash sale created");
      if (saved?.item) {
        setFlashSales((prev) => {
          const exists = prev.some((x) => x.id === saved.item.id);
          return exists
            ? prev.map((x) => (x.id === saved.item.id ? saved.item : x))
            : [saved.item, ...prev];
        });
      }
      resetForm();
      await refreshFlash();
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save flash sale");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
      <h2 className="text-lg font-semibold">Flash sales</h2>
      <p className="text-sm text-meta-3">
        Set a fixed sale price or percentage off for multiple products, categories, or brands.
        When several rules match, customers get the lowest price. Optionally limit each customer
        to one purchase per sale (or per shared sale tag).
      </p>
      {marketingSelectAllBar("flash sale")}
      <ul className="divide-y divide-gray-3 text-sm">
        {flashSales.map((row) => (
          <li key={row.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              {marketingRowCheckbox(row.id, row.name ?? scopeSummary(row))}
              <span className="min-w-0">
                <span className="block font-medium text-dark truncate">
                  {row.name || formatFlashDiscount(row.discount_type, row.discount_value)}
                </span>
                <span className="block text-meta-3 truncate">
                  {formatFlashDiscount(row.discount_type, row.discount_value)} — {scopeSummary(row)}
                  {row.limit_one_per_customer ? " · 1 per customer" : ""}
                  {row.sale_tag ? ` · tag: ${row.sale_tag}` : ""}
                  {!row.is_active ? " · Inactive" : ""}
                </span>
              </span>
            </span>
            <div className="flex items-center gap-3">
              <button type="button" className="text-blue text-sm" onClick={() => startEdit(row)}>
                Edit
              </button>
              <button
                type="button"
                className="text-red-600 text-sm"
                onClick={async () => {
                  if (!confirm("Delete this flash sale?")) return;
                  await j(
                    await fetch(`/api/admin/marketing/flash-sales/${row.id}`, { method: "DELETE" })
                  );
                  toast.success("Deleted");
                  if (editingId === row.id) resetForm();
                  void refreshFlash();
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-gray-3 bg-gray-1/40 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-dark">
          {editingId ? "Edit flash sale" : "Add flash sale"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-medium">Label (optional)</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Hot Wheels weekend"
              className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.limit_one_per_customer}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  limit_one_per_customer: e.target.checked,
                  sale_tag: e.target.checked ? f.sale_tag : "",
                }))
              }
            />
            Limit to one purchase per customer
          </label>
          {form.limit_one_per_customer ? (
            <label className="sm:col-span-2">
              <span className="text-sm font-medium">Sale tag (optional)</span>
              <input
                value={form.sale_tag}
                onChange={(e) => setForm((f) => ({ ...f, sale_tag: e.target.value }))}
                placeholder="e.g. weekend-flash — shared across sales for one claim"
                className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-meta-3">
                Leave blank to limit one purchase per this flash sale only. Same tag = one claim
                across those sales.
              </span>
            </label>
          ) : null}
          <label>
            <span className="text-sm font-medium">Discount type</span>
            <select
              value={form.discount_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  discount_type: e.target.value as FlashDiscountType,
                }))
              }
              className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
            >
              <option value="FIXED">Fixed price (INR)</option>
              <option value="PERCENTAGE">Percentage off</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">
              {form.discount_type === "PERCENTAGE" ? "Percent off" : "Sale price (INR)"}
            </span>
            <input
              type="number"
              step={form.discount_type === "PERCENTAGE" ? "1" : "0.01"}
              min="0"
              max={form.discount_type === "PERCENTAGE" ? "100" : undefined}
              value={form.discount_value}
              onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active
          </label>
        </div>

        <AdminCouponScopeFields
          categories={categories}
          brands={brands}
          categoryIds={form.category_ids}
          brandIds={form.brand_ids}
          productIds={form.product_ids}
          onCategoryIdsChange={(category_ids) => setForm((f) => ({ ...f, category_ids }))}
          onBrandIdsChange={(brand_ids) => setForm((f) => ({ ...f, brand_ids }))}
          onProductIdsChange={(product_ids) => setForm((f) => ({ ...f, product_ids }))}
          enableInactiveProductFilter
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveRule()}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Add flash sale"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-lg border border-gray-3 px-4 py-2 text-sm"
              onClick={resetForm}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
