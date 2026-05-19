"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { applyShopQuery } from "@/lib/shop/shopQuery";

type Props = {
  formId: string;
  /** Current query string (without leading ?) — keeps form in sync after pagination etc. */
  queryString: string;
};

export default function LiveShopFilters({ formId, queryString }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const queryStringFromLocation = () => {
      if (typeof window === "undefined") return queryString;
      return window.location.search.replace(/^\?/, "") || queryString;
    };

    const syncFormFromQuery = () => {
      const usp = new URLSearchParams(queryStringFromLocation());
      const fields = Array.from(
        form.querySelectorAll("input, select, textarea")
      ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

      for (const field of fields) {
        const name = field.name;
        if (!name || name === "page") continue;

        if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
          const selected = new Set(
            usp
              .getAll(name)
              .map((v) => v.trim())
              .filter(Boolean)
          );
          field.checked = selected.has(String(field.value ?? "").trim());
          continue;
        }

        const nextValue = usp.get(name) ?? "";
        if (field.value !== nextValue) {
          field.value = nextValue;
        }
      }
    };

    syncFormFromQuery();

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

    let qDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    const pushFromForm = () => {
      const nextUsp = new URLSearchParams();

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

        if (
          selectedCategoryCount > 0 &&
          field instanceof HTMLInputElement &&
          field.type === "checkbox" &&
          (k === "brand" || k === "subtype" || k === "collection")
        ) {
          const count = optionCountFromLabel(field);
          if (count === 0) continue;
        }

        nextUsp.append(k, value);
      }

      applyShopQuery(pathname, nextUsp.toString());
    };

    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (!t) return;
      // Checkboxes/radios use `change` so `checked` is settled before we read the form.
      if (t.type === "checkbox" || t.type === "radio") return;
      if (t.name === "category") {
        handleCategoryDrivenReset();
      }
      if (t.name === "q") {
        return;
      }
      pushFromForm();
    };

    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t?.name === "category") {
        handleCategoryDrivenReset();
      }
      pushFromForm();
    };

    const onSubmit = (e: Event) => {
      e.preventDefault();
      if (qDebounceTimer) clearTimeout(qDebounceTimer);
      pushFromForm();
    };

    form.addEventListener("input", onInput);
    form.addEventListener("change", onChange);
    form.addEventListener("submit", onSubmit);

    return () => {
      if (qDebounceTimer) clearTimeout(qDebounceTimer);
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onChange);
      form.removeEventListener("submit", onSubmit);
    };
  }, [formId, pathname, queryString]);

  return null;
}
