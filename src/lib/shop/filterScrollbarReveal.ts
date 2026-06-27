const SCROLLBAR_REVEAL_MS = 700;

const SCROLLBAR_REVEAL_SELECTOR =
  ".shop-desktop-sidebar-scroll, .shop-filter-list-scroll";

function isScrollbarRevealTarget(el: EventTarget | null): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    (el.classList.contains("shop-desktop-sidebar-scroll") ||
      el.classList.contains("shop-filter-list-scroll"))
  );
}

/** Show filter sidebar scrollbars only while the user is actively scrolling. */
export function bindShopFilterScrollbarReveal(root: HTMLElement | null): () => void {
  if (!root) return () => {};

  const timeouts = new WeakMap<HTMLElement, number>();

  const onScroll = (event: Event) => {
    const el = event.target;
    if (!isScrollbarRevealTarget(el)) return;

    el.classList.add("is-scrolling");
    const prev = timeouts.get(el);
    if (prev !== undefined) window.clearTimeout(prev);
    timeouts.set(
      el,
      window.setTimeout(() => {
        el.classList.remove("is-scrolling");
        timeouts.delete(el);
      }, SCROLLBAR_REVEAL_MS)
    );
  };

  root.addEventListener("scroll", onScroll, { capture: true, passive: true });

  return () => {
    root.removeEventListener("scroll", onScroll, { capture: true });
    root.querySelectorAll<HTMLElement>(SCROLLBAR_REVEAL_SELECTOR).forEach((el) => {
      el.classList.remove("is-scrolling");
    });
  };
}
