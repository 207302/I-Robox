"use client";

import { PRODUCTS_CSV_COLUMNS } from "@/lib/admin/csvFormats";
import { fileToCsvText } from "@/lib/admin/fileToCsvText";
import { useRef, useState } from "react";
import toast from "react-hot-toast";

async function downloadCsv(url: string, fallbackFilename: string) {
  try {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || "Download failed");
    }
    const cd = res.headers.get("Content-Disposition");
    const m = cd?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i) ?? cd?.match(/filename="([^"]+)"/);
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
    toast.success("Download started");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "Download failed");
  }
}

const FILE_ACCEPT =
  ".csv,.xlsx,text/csv,text/plain,application/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function AdminCsvPage() {
  const [productsCsv, setProductsCsv] = useState("");
  const [inventoryCsv, setInventoryCsv] = useState("");
  const [productsSource, setProductsSource] = useState<string | null>(null);
  const [inventorySource, setInventorySource] = useState<string | null>(null);
  const [loading, setLoading] = useState<"products" | "inventory" | null>(null);
  const [parsing, setParsing] = useState<"products" | "inventory" | null>(null);
  const productsFileRef = useRef<HTMLInputElement>(null);
  const inventoryFileRef = useRef<HTMLInputElement>(null);

  async function upload(kind: "products" | "inventory") {
    const csv = kind === "products" ? productsCsv.trim() : inventoryCsv.trim();
    if (!csv) {
      toast.error("Choose a file or paste CSV text first.");
      return;
    }
    setLoading(kind);
    try {
      const res = await fetch(`/api/admin/csv/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Upload failed");
      toast.success(`Imported ${data.count} rows`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(null);
    }
  }

  async function onProductsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setParsing("products");
    try {
      const csv = await fileToCsvText(f);
      setProductsCsv(csv);
      setProductsSource(f.name);
      toast.success(`Loaded ${f.name}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not read file");
    } finally {
      setParsing(null);
    }
  }

  async function onInventoryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setParsing("inventory");
    try {
      const csv = await fileToCsvText(f);
      setInventoryCsv(csv);
      setInventorySource(f.name);
      toast.success(`Loaded ${f.name}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not read file");
    } finally {
      setParsing(null);
    }
  }

  const exportDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">CSV / Excel import & export</h1>
      <p className="text-sm text-meta-3 max-w-3xl">
        Upload a <b className="text-dark">.csv</b> or <b className="text-dark">.xlsx</b> file, or paste CSV below. Excel files use the{" "}
        <b className="text-dark">first sheet only</b> — put your table on sheet 1. Column headers must
        match the documented names.
      </p>

      <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-dark">Products</h2>
        <p className="text-sm text-meta-3">
          Columns: <b className="text-dark font-mono text-xs">{PRODUCTS_CSV_COLUMNS.join(",")}</b>
        </p>
        <p className="text-xs text-meta-4">
          <b className="text-dark">shipping_per_unit</b> optional — INR added to order shipping per unit sold (omit
          column to leave existing value on update). <b className="text-dark">0</b> uses the default flat fee when the
          cart is below the free-shipping threshold.
        </p>
        <p className="text-xs text-meta-4">
          <b className="text-dark">max_order_quantity</b> optional — per-product cap per order (1-1000). Omit the
          column to leave existing value unchanged on update.
        </p>
        <p className="text-xs text-meta-4">
          <b className="text-dark">hsn_code</b> optional — digits (and commas if multiple codes on one SKU). Used for
          invoices and ShipMozo. Omit the column to leave existing product HSN unchanged on update.
        </p>
        <p className="text-xs text-meta-4">
          <b className="text-dark">gst_percent</b> optional — GST rate on the SKU: <b className="text-dark">0</b>,{" "}
          <b className="text-dark">5</b>, <b className="text-dark">12</b>, <b className="text-dark">18</b>, or{" "}
          <b className="text-dark">28</b>. List price is GST-inclusive; invoices split taxable vs GST. Omit the column
          to leave existing value unchanged on update.
        </p>
        <p className="text-xs text-meta-4">
          <b className="text-dark">weight_g</b> optional — packed weight in grams (product + box) for ShipMozo. Omit the
          column to leave existing value unchanged on update.
        </p>
        <p className="text-xs text-meta-4">
          <b className="text-dark">diecast_scale</b> optional — denominator (<b className="text-dark">64</b>) or ratio (
          <b className="text-dark">1:64</b>); matches the scale catalog (new values are added automatically on import).
          Omit the column to keep existing assignment on update.
        </p>
        <p className="text-xs text-meta-4">
          <b className="text-dark">image_urls</b> optional — full image link(s), starting with{" "}
          <b className="text-dark">https://</b>. One URL per cell, or several separated by{" "}
          <b className="text-dark">|</b>. When provided, replaces existing product gallery images. Leave blank to keep
          current images on update.
        </p>
        <p className="text-xs text-meta-4">
          <b className="text-dark">slug</b> optional — leave blank to auto-generate from <b className="text-dark">name</b>{" "}
          (same rules as creating a product in admin). If set, rows upsert by that slug.
        </p>
        <p className="text-xs text-meta-4">
          Stock columns optional on import (defaults <b className="text-dark">0</b> / <b className="text-dark">5</b>
          ).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCsv("/api/admin/csv/products/export", `products-export-${exportDate}.csv`)
            }
            className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
          >
            Download all products
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("/api/admin/csv/products/template", "Products.csv")}
            className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
          >
            Download Products.csv template
          </button>
          <input
            ref={productsFileRef}
            type="file"
            accept={FILE_ACCEPT}
            className="hidden"
            onChange={(e) => void onProductsFile(e)}
          />
          <button
            type="button"
            disabled={parsing === "products"}
            onClick={() => productsFileRef.current?.click()}
            className="rounded-lg bg-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-60"
          >
            {parsing === "products" ? "Reading file…" : "Choose file (CSV / Excel)"}
          </button>
          {productsSource ? (
            <span className="text-xs text-meta-3">
              Loaded: <span className="font-medium text-dark">{productsSource}</span>
            </span>
          ) : null}
        </div>
        <p className="text-xs font-medium text-meta-2">Preview & edit (optional)</p>
        <textarea
          value={productsCsv}
          onChange={(e) => {
            setProductsCsv(e.target.value);
            setProductsSource(null);
          }}
          rows={8}
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue font-mono"
          placeholder={`Paste CSV here, or use “Choose file” above.\n\n${PRODUCTS_CSV_COLUMNS.join(",")}\nToy Car,,199,149,SKU-1,95030010,64,true,50,5`}
        />
        <button
          type="button"
          disabled={loading === "products" || parsing === "products"}
          onClick={() => void upload("products")}
          className="rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
        >
          {loading === "products" ? "Importing…" : "Import products"}
        </button>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-dark">Inventory</h2>
        <p className="text-sm text-meta-3">
          Columns: <b className="text-dark">product_slug,available_quantity,low_stock_threshold</b>
        </p>
        <p className="text-xs text-meta-4">
          Updates stock for existing products only (match on <b className="text-dark">product_slug</b>).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCsv("/api/admin/csv/inventory/export", `inventory-export-${exportDate}.csv`)
            }
            className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
          >
            Download all inventory
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("/api/admin/csv/inventory/template", "Inventory.csv")}
            className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
          >
            Download Inventory.csv template
          </button>
          <input
            ref={inventoryFileRef}
            type="file"
            accept={FILE_ACCEPT}
            className="hidden"
            onChange={(e) => void onInventoryFile(e)}
          />
          <button
            type="button"
            disabled={parsing === "inventory"}
            onClick={() => inventoryFileRef.current?.click()}
            className="rounded-lg bg-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-60"
          >
            {parsing === "inventory" ? "Reading file…" : "Choose file (CSV / Excel)"}
          </button>
          {inventorySource ? (
            <span className="text-xs text-meta-3">
              Loaded: <span className="font-medium text-dark">{inventorySource}</span>
            </span>
          ) : null}
        </div>
        <p className="text-xs font-medium text-meta-2">Preview & edit (optional)</p>
        <textarea
          value={inventoryCsv}
          onChange={(e) => {
            setInventoryCsv(e.target.value);
            setInventorySource(null);
          }}
          rows={8}
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue font-mono"
          placeholder={`Paste CSV here, or use “Choose file” above.\n\nproduct_slug,available_quantity,low_stock_threshold\ntoy-car,50,5`}
        />
        <button
          type="button"
          disabled={loading === "inventory" || parsing === "inventory"}
          onClick={() => void upload("inventory")}
          className="rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
        >
          {loading === "inventory" ? "Importing…" : "Import inventory"}
        </button>
      </div>
    </div>
  );
}
