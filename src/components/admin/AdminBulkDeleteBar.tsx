"use client";

type AdminBulkDeleteBarProps = {
  selectedCount: number;
  deleting?: boolean;
  inactivating?: boolean;
  itemLabel?: string;
  onClear: () => void;
  onDelete: () => void;
  onInactive?: () => void;
};

export function AdminBulkDeleteBar({
  selectedCount,
  deleting = false,
  inactivating = false,
  itemLabel = "item",
  onClear,
  onDelete,
  onInactive,
}: AdminBulkDeleteBarProps) {
  if (selectedCount === 0) return null;

  const plural = selectedCount === 1 ? itemLabel : `${itemLabel}s`;
  const busy = deleting || inactivating;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-meta-3">
        {selectedCount} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        disabled={busy}
        className="text-sm font-medium text-meta-3 hover:text-blue disabled:opacity-60"
      >
        Clear selection
      </button>
      {onInactive ? (
        <button
          type="button"
          disabled={busy}
          onClick={onInactive}
          className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 disabled:opacity-60"
        >
          {inactivating ? "Setting inactive…" : `Set inactive (${selectedCount} ${plural})`}
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        {deleting ? "Deleting…" : `Delete selected (${selectedCount} ${plural})`}
      </button>
    </div>
  );
}
