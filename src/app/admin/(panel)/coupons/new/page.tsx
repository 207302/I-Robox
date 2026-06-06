"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AdminCouponScopeFields } from "@/components/admin/AdminCouponScopeFields";

type TaxonomyItem = { id: string; name: string };

export default function NewCouponPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [brands, setBrands] = useState<TaxonomyItem[]>([]);
  const [form, setForm] = useState<any>({
    code: "",
    discount_type: "PERCENTAGE",
    discount_value: "",
    min_cart_value: "",
    max_uses: "",
    max_uses_per_user: "",
    starts_at: "",
    ends_at: "",
    is_active: true,
    category_ids: [] as string[],
    brand_ids: [] as string[],
    product_ids: [] as string[],
  });

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/brands").then((r) => r.json()),
    ])
      .then(([catData, brandData]) => {
        if (Array.isArray(catData)) setCategories(catData);
        if (Array.isArray(brandData)) setBrands(brandData);
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed");
      toast.success("Coupon created");
      router.push(`/admin/coupons/${data.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-dark">New coupon</h1>
      <form onSubmit={submit} className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-dark">Code</span>
          <input
            required
            value={form.code}
            onChange={(e) => setForm((f: any) => ({ ...f, code: e.target.value.toUpperCase() }))}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Type</span>
            <select
              value={form.discount_type}
              onChange={(e) => setForm((f: any) => ({ ...f, discount_type: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            >
              <option value="PERCENTAGE">PERCENTAGE</option>
              <option value="FIXED">FIXED</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Value</span>
            <input
              required
              value={form.discount_value}
              onChange={(e) => setForm((f: any) => ({ ...f, discount_value: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-dark">Min cart value (optional)</span>
          <input
            value={form.min_cart_value}
            onChange={(e) => setForm((f: any) => ({ ...f, min_cart_value: e.target.value }))}
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Max uses (optional)</span>
            <input
              value={form.max_uses}
              onChange={(e) => setForm((f: any) => ({ ...f, max_uses: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Max uses per user (optional)</span>
            <input
              value={form.max_uses_per_user}
              onChange={(e) => setForm((f: any) => ({ ...f, max_uses_per_user: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Starts at (optional)</span>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm((f: any) => ({ ...f, starts_at: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Ends at (optional)</span>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm((f: any) => ({ ...f, ends_at: e.target.value }))}
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
        </div>

        <AdminCouponScopeFields
          categories={categories}
          brands={brands}
          categoryIds={form.category_ids}
          brandIds={form.brand_ids}
          productIds={form.product_ids}
          onCategoryIdsChange={(category_ids) => setForm((f: any) => ({ ...f, category_ids }))}
          onBrandIdsChange={(brand_ids) => setForm((f: any) => ({ ...f, brand_ids }))}
          onProductIdsChange={(product_ids) => setForm((f: any) => ({ ...f, product_ids }))}
        />

        <label className="flex items-center gap-2 text-sm text-meta-3">
          <input
            type="checkbox"
            checked={Boolean(form.is_active)}
            onChange={(e) => setForm((f: any) => ({ ...f, is_active: e.target.checked }))}
          />
          Active
        </label>

        <button
          disabled={loading}
          className="rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create coupon"}
        </button>
      </form>
    </div>
  );
}
