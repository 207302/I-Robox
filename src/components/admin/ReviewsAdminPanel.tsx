"use client";

import Link from "next/link";
import { useState } from "react";

export type AdminReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  is_approved: boolean;
  is_verified_purchase: boolean;
  created_at: string;
  productName: string;
  productSlug: string;
  customerEmail: string | null;
};

function formatReviewDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function ReviewsAdminPanel({ reviews }: { reviews: AdminReviewRow[] }) {
  const [selected, setSelected] = useState<AdminReviewRow | null>(null);

  return (
    <>
      <div className="rounded-2xl border border-gray-3 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta-3 border-b border-gray-3">
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">Rating</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Approved</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className="border-b border-gray-3 align-top">
                <td className="py-3 px-4 max-w-xs">
                  {r.productSlug ? (
                    <Link
                      href={`/shop/${r.productSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue hover:underline"
                    >
                      {r.productName}
                    </Link>
                  ) : (
                    <div className="font-semibold text-dark">{r.productName}</div>
                  )}
                  <div className="mt-1 text-xs text-meta-4 line-clamp-2">
                    {r.title ? `${r.title} — ` : ""}
                    {r.comment}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="mt-2 text-xs font-medium text-blue hover:underline"
                  >
                    View full review
                  </button>
                </td>
                <td className="py-3 px-4 text-dark whitespace-nowrap">
                  {r.rating}/5{" "}
                  {r.is_verified_purchase ? (
                    <span className="ml-2 text-xs rounded-full bg-gray-1 border border-gray-3 px-2 py-1 text-dark">
                      Verified
                    </span>
                  ) : null}
                </td>
                <td className="py-3 px-4 text-dark">{r.customerEmail ?? "—"}</td>
                <td className="py-3 px-4 text-dark whitespace-nowrap">
                  {r.is_approved ? "Yes" : "No"}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {r.is_approved ? (
                    <form action={`/api/admin/reviews/${r.id}/delete`} method="post" className="inline">
                      <button className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                    </form>
                  ) : (
                    <>
                      <form action={`/api/admin/reviews/${r.id}/approve`} method="post" className="inline">
                        <button className="text-sm font-medium text-blue hover:underline">Approve</button>
                      </form>
                      <span className="mx-2 text-meta-4">|</span>
                      <form action={`/api/admin/reviews/${r.id}/reject`} method="post" className="inline">
                        <button className="text-sm font-medium text-meta-3 hover:text-dark">Reject</button>
                      </form>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {reviews.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-sm text-meta-3" colSpan={5}>
                  No reviews yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-3 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="review-modal-title" className="text-lg font-semibold text-dark">
                Review details
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-meta-3 hover:text-dark"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-meta-3">Product</dt>
                <dd className="mt-0.5 font-medium text-dark">
                  {selected.productSlug ? (
                    <Link
                      href={`/shop/${selected.productSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue hover:underline"
                    >
                      {selected.productName}
                    </Link>
                  ) : (
                    selected.productName
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-meta-3">Rating</dt>
                <dd className="mt-0.5 text-dark">
                  {selected.rating}/5
                  {selected.is_verified_purchase ? " · Verified purchase" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-meta-3">Customer</dt>
                <dd className="mt-0.5 text-dark">{selected.customerEmail ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-meta-3">Submitted</dt>
                <dd className="mt-0.5 text-dark">{formatReviewDate(selected.created_at)}</dd>
              </div>
              {selected.title ? (
                <div>
                  <dt className="text-meta-3">Title</dt>
                  <dd className="mt-0.5 font-medium text-dark">{selected.title}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-meta-3">Review</dt>
                <dd className="mt-0.5 whitespace-pre-line leading-relaxed text-dark">
                  {selected.comment}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              {selected.productSlug ? (
                <Link
                  href={`/shop/${selected.productSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white"
                >
                  View product
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-gray-3 px-4 py-2 text-sm font-medium text-dark"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
