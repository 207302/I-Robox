"use client";

type AdminBulkDeleteBarProps = {
  selectedCount: number;
  deleting?: boolean;
  itemLabel?: string;
  onClear: () => void;
  onDelete: () => void;
};

export function AdminBulkDeleteBar({
  selectedCount,
  deleting = false,
  itemLabel = "item",
  onClear,
  onDelete,
}: AdminBulkDeleteBarProps) {
  if (selectedCount === 0) return null;

  const plural = selectedCount === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-meta-3">
        {selectedCount} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-sm font-medium text-meta-3 hover:text-blue"
      >
        Clear selection
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={onDelete}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        {deleting ? "Deleting…" : `Delete selected (${selectedCount} ${plural})`}
      </button>
    </div>
  );
}
