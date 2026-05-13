"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { startTransition, useEffect } from "react";

type Props = {
  formId: string;
};

export default function LiveShopFilters({ formId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const syncFormFromQuery = () => {
      const fields = Array.from(
        form.querySelectorAll("input, select, textarea")
      ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

      for (const field of fields) {
        const name = field.name;
        if (!name || name === "page") continue;

        if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
          const selected = new Set(
            searchParams
              .getAll(name)
              .map((v) => v.trim())
              .filter(Boolean)
          );
          field.checked = selected.has(String(field.value ?? "").trim());
          continue;
        }

        const nextValue = searchParams.get(name) ?? "";
        if (field.value !== nextValue) {
          field.value = nextValue;
        }
      }
    };

    syncFormFromQuery();

    let debounceTimer: number | null = null;
    let prevCategorySignature = Array.from(
      form.querySelectorAll('input[name="category"]:checked')
    )
      .map((n) => (n as HTMLInputElement).value)
      .sort()
      .join("|");

    const optionCountFromLabel = (el: Element): number | null => {
      const label = el.closest("label");
      const text = label?.textContent ?? "";
      const m = text.match(/\((\d+)\)\s*$/);
      if (!m) return null;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    };

    const clearAllNonCategorySelections = () => {
      const fields = Array.from(
        form.querySelectorAll("input, select, textarea")
      ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

      for (const field of fields) {
        const name = field.name;
        if (!name || name === "category" || name === "page") continue;

        if (field instanceof HTMLInputElement) {
          if (field.type === "checkbox" || field.type === "radio") {
            field.checked = false;
            continue;
          }
          field.value = "";
          continue;
        }

        if (field instanceof HTMLSelectElement) {
          field.value = "";
          continue;
        }

        field.value = "";
      }
    };

    const handleCategoryDrivenReset = () => {
      const currentSignature = Array.from(
        form.querySelectorAll('input[name="category"]:checked')
      )
        .map((n) => (n as HTMLInputElement).value)
        .sort()
        .join("|");

      if (currentSignature !== prevCategorySignature) {
        clearAllNonCategorySelections();
        prevCategorySignature = currentSignature;
      }
    };

    const pushFromForm = (delayMs: number) => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        const usp = new URLSearchParams();

        const selectedCategoryCount = form.querySelectorAll('input[name="category"]:checked').length;
        const inputs = Array.from(
          form.querySelectorAll("input, select, textarea")
        ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

        for (const field of inputs) {
          const k = field.name;
          if (!k || k === "page" || field.disabled) continue;

          if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
            if (!field.checked) continue;
          }

          const value = String(field.value ?? "").trim();
          if (!value) continue;

          // Category-dependent facets: avoid persisting stale selections that now show as (0)
          if (
            selectedCategoryCount > 0 &&
            field instanceof HTMLInputElement &&
            field.type === "checkbox" &&
            (k === "brand" || k === "type" || k === "subtype" || k === "collection")
          ) {
            const count = optionCountFromLabel(field);
            if (count === 0) continue;
          }

          usp.append(k, value);
        }
        const q = usp.toString();
        startTransition(() => {
          router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
        });
      }, delayMs);
    };

    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (!t) return;
      if (t.name === "category") {
        handleCategoryDrivenReset();
      }
      const isTextLike =
        t.tagName === "TEXTAREA" ||
        (t.tagName === "INPUT" && (t.type === "text" || t.type === "search" || t.type === "number"));
      pushFromForm(isTextLike ? 250 : 80);
    };

    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t?.name === "category") {
        handleCategoryDrivenReset();
      }
      pushFromForm(80);
    };
    const onSubmit = (e: Event) => {
      e.preventDefault();
      pushFromForm(0);
    };

    form.addEventListener("input", onInput);
    form.addEventListener("change", onChange);
    form.addEventListener("submit", onSubmit);

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onChange);
      form.removeEventListener("submit", onSubmit);
    };
  }, [formId, pathname, router, searchParams]);

  return null;
}

