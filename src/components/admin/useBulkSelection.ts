"use client";

import { useCallback, useMemo, useState } from "react";

export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectedCount = selectedIds.size;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleMany = useCallback((ids: string[], selectAll: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selectAll) {
        for (const id of ids) next.add(id);
      } else {
        for (const id of ids) next.delete(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const deselectMany = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const selectionForPage = useCallback(
    (pageIds: string[]) => {
      const allOnPageSelected =
        pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
      const someOnPageSelected = pageIds.some((id) => selectedIds.has(id));
      return { allOnPageSelected, someOnPageSelected };
    },
    [selectedIds]
  );

  const selectedArray = useMemo(() => [...selectedIds], [selectedIds]);

  return {
    selectedIds,
    selectedArray,
    selectedCount,
    toggleOne,
    toggleMany,
    clearSelection,
    deselectMany,
    isSelected,
    selectionForPage,
  };
}
