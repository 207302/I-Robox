"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";

/** Permanent — user completed signup. */
const SUBMITTED_KEY = "irobox_launch_notify_done";
const OPEN_DELAY_MS = 4500;
const NAV_OPEN_DELAY_MS = 400;

const HIDE_PATH_PREFIXES = ["/checkout", "/login", "/admin", "/payment"];

function shouldHideOnPath(pathname: string) {
  return HIDE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Shop listing only (`/shop`) — not homepage or product detail pages. */
function isEligiblePath(pathname: string) {
  if (pathname !== "/shop") return false;
  return !shouldHideOnPath(pathname);
}

function hasSubmitted() {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(SUBMITTED_KEY));
}

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-[calc(50%-2px)] text-meta-4">
      {children}
    </span>
  );
}

function InputShell({ children }: { children: React.ReactNode }) {
  return <div className="relative">{children}</div>;
}

export default function LaunchNotifyPopup() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "open" | "minimized">("idle");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [entered, setEntered] = useState(false);

  const eligible = isEligiblePath(pathname);

  useEffect(() => {
    if (phase !== "open" && phase !== "minimized") {
      setEntered(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [phase, pathname]);

  useEffect(() => {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    if (!eligible) {
      setPhase("idle");
      prevPathRef.current = pathname;
      return;
    }

    if (hasSubmitted()) {
      setPhase("idle");
      prevPathRef.current = pathname;
      return;
    }

    const prev = prevPathRef.current;
    const isNavigation = prev !== null && prev !== pathname;
    prevPathRef.current = pathname;

    const delay = isNavigation ? NAV_OPEN_DELAY_MS : OPEN_DELAY_MS;
    openTimerRef.current = window.setTimeout(() => {
      setPhase("open");
      openTimerRef.current = null;
    }, delay);

    return () => {
      if (openTimerRef.current != null) {
        window.clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
    };
  }, [pathname, eligible]);

  function markDone() {
    localStorage.setItem(SUBMITTED_KEY, "1");
    setPhase("idle");
  }

  function handleDismiss() {
    setPhase("minimized");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/marketing/notify-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: name, phone, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save your details");
      toast.success("You're on the list! We'll notify you about new launches.");
      markDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!eligible || phase === "idle" || hasSubmitted()) return null;

  if (phase === "minimized") {
    return (
      <button
        type="button"
        onClick={() => setPhase("open")}
        className={`fixed bottom-24 right-4 z-[61] inline-flex items-center gap-2 rounded-full border border-blue/20 bg-white px-4 py-2.5 text-sm font-semibold text-blue shadow-lg transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-blue/5 sm:right-6 ${
          entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
        aria-label="Open launch notifications signup"
      >
        <span aria-hidden>🎁</span>
        Get launch alerts
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-24 right-4 z-[61] w-[min(100vw-2rem,340px)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:right-6 ${
        entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="launch-notify-title"
    >
      <div className="overflow-hidden rounded-2xl border border-gray-3 bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-blue/10 via-white to-blue/5 px-4 pb-3 pt-4">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-meta-3 hover:bg-white/80 hover:text-dark"
            aria-label="Minimize"
          >
            ✕
          </button>
          <div className="flex items-start gap-2 pr-8">
            <span className="text-xl" aria-hidden>
              📣
            </span>
            <div>
              <h2 id="launch-notify-title" className="text-base font-bold leading-snug text-dark">
                Never miss new <span className="text-blue">toy launches</span>!
              </h2>
              <p className="mt-1 text-xs text-meta-3">
                New arrivals, offers &amp; limited editions — straight to your inbox.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-dark">Full name</span>
            <InputShell>
              <FieldIcon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </FieldIcon>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-gray-3 bg-gray-1 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors duration-200 ease-out focus:border-blue"
                autoComplete="name"
              />
            </InputShell>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-dark">Mobile number</span>
            <InputShell>
              <FieldIcon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </FieldIcon>
              <input
                required
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full rounded-lg border border-gray-3 bg-gray-1 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors duration-200 ease-out focus:border-blue"
                autoComplete="tel"
              />
            </InputShell>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-dark">Email address</span>
            <InputShell>
              <FieldIcon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </FieldIcon>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-lg border border-gray-3 bg-gray-1 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors duration-200 ease-out focus:border-blue"
                autoComplete="email"
              />
            </InputShell>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-2.5 text-sm font-semibold text-white hover:bg-blue-dark disabled:opacity-60"
          >
            {loading ? "Saving…" : "Notify me"}
            {!loading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            ) : null}
          </button>

          <p className="text-center text-[11px] text-meta-4">We respect your privacy. No spam, ever.</p>
        </form>
      </div>
    </div>
  );
}
