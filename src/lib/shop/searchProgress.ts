export const SEARCH_PROGRESS_EVENT = "irobox-search-progress";

export type SearchProgressDetail = {
  percent: number;
};

let navigationPending = false;
let currentPercent = 0;

export function getSearchProgress(): number {
  return currentPercent;
}

export function isSearchProgressPending(): boolean {
  return navigationPending;
}

export function startSearchProgress(): void {
  navigationPending = true;
  setSearchProgress(8);
}

export function setSearchProgress(percent: number): void {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  currentPercent = value;
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SearchProgressDetail>(SEARCH_PROGRESS_EVENT, {
      detail: { percent: value },
    })
  );
  if (value >= 100) {
    navigationPending = false;
  }
}

export function completeSearchProgress(): void {
  setSearchProgress(100);
}
