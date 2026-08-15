"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchAdminWithRetry } from "@/lib/admin/fetchWithRetry";
import { formatPrice } from "@/utils/formatePrice";
import { getShippingAddressValidationError } from "@/lib/validation/address";
import { sanitizeIndianPhoneInput } from "@/lib/auth/indianMobile";
import { sanitizeIndianPinInput } from "@/lib/validation/address";
import { orderShippingInrFromLines } from "@/lib/checkout/orderShipping";
import { AdminProductThumbnail } from "@/components/admin/AdminProductThumbnail";

type CatalogProduct = {
  id: string;
  name: string;
  sku: string | null;
  catalogUnit: number;
  shippingPerUnit: number;
  brandId: string | null;
  available: number;
  imageUrl: string | null;
};

type CustomerHit = {
  id: string;
  name: string | null;
  email: string;
  displayEmail: string | null;
  phone: string | null;
  latestAddress: {
    full_name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  } | null;
};

type Line = {
  product: CatalogProduct;
  quantity: number;
  unitPrice: number;
};

type AddressForm = {
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

const emptyAddress: AddressForm = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
};

export function AdminCreateOrderClient() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<CustomerHit[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [productQuery, setProductQuery] = useState("");
  const [productHits, setProductHits] = useState<CatalogProduct[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [freeShippingThresholdInr, setFreeShippingThresholdInr] = useState<number | null>(2000);
  const [excludedBrandIds, setExcludedBrandIds] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  const [address, setAddress] = useState<AddressForm>(emptyAddress);
  const [generatePaymentLink, setGeneratePaymentLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    orderId: string;
    orderNumber: string;
    paymentLinkUrl: string | null;
    paymentLinkError: string | null;
    paymentStatus: string;
  } | null>(null);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [lines]
  );
  const shipping = useMemo(
    () =>
      orderShippingInrFromLines({
        subtotalBeforeDiscount: subtotal,
        lines: lines.map((l) => ({
          quantity: l.quantity,
          shippingPerUnit: l.product.shippingPerUnit,
          lineSubtotal: l.unitPrice * l.quantity,
          brandId: l.product.brandId,
        })),
        freeShippingThresholdInr,
        freeShippingExcludedBrandIds: excludedBrandIds,
      }),
    [lines, subtotal, freeShippingThresholdInr, excludedBrandIds]
  );
  const total = Math.round((subtotal + shipping) * 100) / 100;

  async function searchCustomers() {
    const q = customerQuery.trim();
    if (q.length < 2) {
      toast.error("Type at least 2 characters to search");
      return;
    }
    setCustomerSearching(true);
    try {
      const res = await fetchAdminWithRetry(
        `/api/admin/orders/manual/customers?q=${encodeURIComponent(q)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Customer search failed");
      setCustomerHits(data.customers ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Customer search failed");
    } finally {
      setCustomerSearching(false);
    }
  }

  async function searchProducts() {
    const q = productQuery.trim();
    if (q.length < 2) {
      toast.error("Type at least 2 characters to search");
      return;
    }
    setProductSearching(true);
    try {
      const res = await fetchAdminWithRetry(
        `/api/admin/orders/manual/products?q=${encodeURIComponent(q)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Product search failed");
      setProductHits(data.products ?? []);
      if (data.freeShippingThresholdInr !== undefined) {
        setFreeShippingThresholdInr(data.freeShippingThresholdInr);
      }
      if (Array.isArray(data.freeShippingExcludedBrandIds)) {
        setExcludedBrandIds(data.freeShippingExcludedBrandIds);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Product search failed");
    } finally {
      setProductSearching(false);
    }
  }

  function pickCustomer(c: CustomerHit) {
    setSelectedCustomer(c);
    setAddingCustomer(false);
    const a = c.latestAddress;
    setAddress({
      full_name: a?.full_name || c.name || "",
      phone: sanitizeIndianPhoneInput(a?.phone || c.phone || ""),
      line1: a?.line1 || "",
      line2: a?.line2 || "",
      city: a?.city || "",
      state: a?.state || "",
      postal_code: sanitizeIndianPinInput(a?.postal_code || ""),
      country: a?.country || "India",
    });
  }

  function addProduct(p: CatalogProduct) {
    if (p.available <= 0) {
      toast.error(`${p.name} is out of stock`);
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        if (existing.quantity + 1 > p.available) {
          toast.error(`Only ${p.available} available`);
          return prev;
        }
        return prev.map((l) =>
          l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product: p, quantity: 1, unitPrice: p.catalogUnit }];
    });
  }

  function updateLine(productId: string, patch: Partial<Pick<Line, "quantity" | "unitPrice">>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.product.id !== productId) return l;
        const quantity = patch.quantity ?? l.quantity;
        if (quantity > l.product.available) {
          toast.error(`Only ${l.product.available} available`);
          return l;
        }
        return { ...l, ...patch, quantity: Math.max(1, quantity) };
      })
    );
  }

  function goToAddress() {
    if (!selectedCustomer && !addingCustomer) {
      toast.error("Select a customer or add a new one");
      return;
    }
    if (addingCustomer) {
      if (!newName.trim() || sanitizeIndianPhoneInput(newPhone).length !== 10) {
        toast.error("New customer needs a name and valid 10-digit phone");
        return;
      }
      setAddress((a) => ({
        ...a,
        full_name: a.full_name || newName.trim(),
        phone: a.phone || sanitizeIndianPhoneInput(newPhone),
      }));
    }
    if (lines.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    setStep(2);
  }

  function goToPayment() {
    const err = getShippingAddressValidationError(address);
    if (err) {
      toast.error(err);
      return;
    }
    setStep(3);
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetchAdminWithRetry("/api/admin/orders/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId: addingCustomer ? null : selectedCustomer?.id,
          newCustomer: addingCustomer
            ? { name: newName.trim(), phone: sanitizeIndianPhoneInput(newPhone), email: newEmail.trim() || null }
            : null,
          items: lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
          address,
          generatePaymentLink,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not create order");
      setResult({
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        paymentLinkUrl: data.paymentLink?.url ?? null,
        paymentLinkError: data.paymentLinkError ?? null,
        paymentStatus: data.paymentStatus,
      });
      toast.success(`Order ${data.orderNumber} created`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create order");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-dark">Order created</h2>
        <p className="text-sm text-meta-3">
          {result.orderNumber} — payment {result.paymentStatus === "SUCCEEDED" ? "marked paid (offline)" : "pending"}
        </p>
        {result.paymentLinkUrl ? (
          <div className="space-y-2">
            <p className="text-sm text-dark">Payment link (share this manually):</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={result.paymentLinkUrl}
                className="min-w-0 flex-1 rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
              <button
                type="button"
                className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.paymentLinkUrl!);
                  toast.success("Copied");
                }}
              >
                Copy link
              </button>
            </div>
          </div>
        ) : result.paymentLinkError ? (
          <p className="text-sm text-red-700">
            Order saved as pending payment, but the link failed: {result.paymentLinkError}. Open the
            order to generate a link later.
          </p>
        ) : null}
        <div className="flex gap-3">
          <Link href={`/admin/orders/${result.orderId}`} className="text-sm font-medium text-blue hover:underline">
            Open order
          </Link>
          <Link href="/admin/orders" className="text-sm font-medium text-meta-3 hover:text-blue">
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-meta-3">Step {step} of 3</p>

      {step === 1 ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-3 bg-white p-5 space-y-3">
            <h2 className="font-semibold text-dark">Customer</h2>
            <div className="flex gap-2">
              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void searchCustomers();
                  }
                }}
                placeholder="Search name, phone, or email"
                className="min-w-0 flex-1 rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void searchCustomers()}
                disabled={customerSearching}
                className="rounded-lg border border-gray-3 px-3 py-2 text-sm"
              >
                Search
              </button>
            </div>
            <ul className="divide-y divide-gray-3">
              {customerHits.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pickCustomer(c)}
                    className={`w-full px-2 py-2 text-left text-sm ${
                      selectedCustomer?.id === c.id ? "bg-blue/5" : ""
                    }`}
                  >
                    <span className="font-medium text-dark">{c.name || "No name"}</span>
                    <span className="ml-2 text-meta-3">
                      {c.displayEmail || c.phone || c.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selectedCustomer ? (
              <p className="text-sm text-green-700">
                Selected {selectedCustomer.name || selectedCustomer.displayEmail || selectedCustomer.id}
              </p>
            ) : null}
            <button
              type="button"
              className="text-sm font-medium text-blue"
              onClick={() => {
                setAddingCustomer(true);
                setSelectedCustomer(null);
              }}
            >
              + Add new customer
            </button>
            {addingCustomer ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name *"
                  className="rounded-lg border border-gray-3 px-3 py-2 text-sm"
                />
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(sanitizeIndianPhoneInput(e.target.value))}
                  placeholder="Phone *"
                  className="rounded-lg border border-gray-3 px-3 py-2 text-sm"
                />
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="rounded-lg border border-gray-3 px-3 py-2 text-sm"
                />
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-gray-3 bg-white p-5 space-y-3">
            <h2 className="font-semibold text-dark">Products</h2>
            <div className="flex gap-2">
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void searchProducts();
                  }
                }}
                placeholder="Search product name or SKU"
                className="min-w-0 flex-1 rounded-lg border border-gray-3 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void searchProducts()}
                disabled={productSearching}
                className="rounded-lg border border-gray-3 px-3 py-2 text-sm"
              >
                Search
              </button>
            </div>
            <ul className="divide-y divide-gray-3">
              {productHits.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <AdminProductThumbnail url={p.imageUrl} alt={p.name} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-dark">{p.name}</div>
                    <div className="text-xs text-meta-3">
                      {formatPrice(p.catalogUnit)} · {p.available} in stock
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addProduct(p)}
                    className="text-sm font-medium text-blue"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>

            {lines.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-meta-3">
                    <th className="py-2">Item</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Line</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.product.id} className="border-t border-gray-3">
                      <td className="py-2 pr-2">{l.product.name}</td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          max={l.product.available}
                          value={l.quantity}
                          onChange={(e) =>
                            updateLine(l.product.id, { quantity: Number(e.target.value) || 1 })
                          }
                          className="w-16 rounded border border-gray-3 px-1 py-1"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.unitPrice}
                          onChange={(e) =>
                            updateLine(l.product.id, { unitPrice: Number(e.target.value) || 0 })
                          }
                          className="w-24 rounded border border-gray-3 px-1 py-1"
                        />
                        {l.unitPrice !== l.product.catalogUnit ? (
                          <div className="text-xs text-amber-700">was {formatPrice(l.product.catalogUnit)}</div>
                        ) : null}
                      </td>
                      <td>{formatPrice(l.unitPrice * l.quantity)}</td>
                      <td>
                        <button
                          type="button"
                          className="text-meta-3"
                          onClick={() => setLines((prev) => prev.filter((x) => x.product.id !== l.product.id))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <p className="text-sm font-medium text-dark">Subtotal {formatPrice(subtotal)}</p>
          </section>

          <button
            type="button"
            onClick={goToAddress}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white"
          >
            Continue to address
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <section className="rounded-2xl border border-gray-3 bg-white p-5 space-y-3">
          <h2 className="font-semibold text-dark">Contact & address</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["full_name", "Full name"],
                ["phone", "Phone"],
                ["line1", "Address line 1"],
                ["line2", "Address line 2"],
                ["city", "City"],
                ["state", "State"],
                ["postal_code", "PIN code"],
                ["country", "Country"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm text-meta-3">
                {label}
                <input
                  value={address[key]}
                  onChange={(e) => {
                    let value = e.target.value;
                    if (key === "phone") value = sanitizeIndianPhoneInput(value);
                    if (key === "postal_code") value = sanitizeIndianPinInput(value);
                    setAddress((a) => ({ ...a, [key]: value }));
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm text-dark"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-gray-3 px-4 py-2 text-sm">
              Back
            </button>
            <button
              type="button"
              onClick={goToPayment}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white"
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-2xl border border-gray-3 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-dark">Payment & create</h2>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>{formatPrice(shipping)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
          <label className="flex items-start gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={generatePaymentLink}
              onChange={(e) => setGeneratePaymentLink(e.target.checked)}
              className="mt-1"
            />
            <span>
              Generate Razorpay payment link (unchecked = already paid offline — cash / bank transfer).
              The link is not emailed; you copy and share it.
            </span>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="rounded-lg border border-gray-3 px-4 py-2 text-sm">
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit()}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create order"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
