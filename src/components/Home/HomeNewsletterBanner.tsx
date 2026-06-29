"use client";

import { FormEvent, useState } from "react";
import { Users } from "lucide-react";
import { chromeBgStyle, chromeTextStyle } from "@/lib/marketing/chromeColors";
import { validateEmailAddress } from "@/lib/validation/rules";

type Props = {
  footerBg?: string | null;
  footerText?: string | null;
};

export default function HomeNewsletterBanner({ footerBg, footerText }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBgStyle = chromeBgStyle(footerBg);
  const textStyle = chromeTextStyle(footerText);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const emailResult = validateEmailAddress(email, { commonProviderOnly: true });
    if (!emailResult.ok) {
      setError(emailResult.error);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/marketing/notify-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailResult.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Something went wrong. Please try again."
        );
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-visible bg-white px-4 pb-8 pt-4 sm:px-8 md:pb-10 xl:px-0">
      <div className="mx-auto w-full max-w-7xl">
        <div
          className={`rounded-2xl px-6 py-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)] sm:px-8 sm:py-7 ${
            cardBgStyle ? "" : "bg-gray-900"
          }`}
          style={cardBgStyle}
        >
          {success ? (
            <p className="text-center text-base font-medium text-white" style={textStyle}>
              You&apos;re in! We&apos;ll keep you posted. 🎉
            </p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 md:flex-row md:items-center"
            >
              <div className="flex items-start gap-3 md:shrink-0">
                <Users
                  className="h-8 w-8 shrink-0 text-white"
                  style={textStyle}
                  aria-hidden
                />
                <div>
                  <p className="text-lg font-bold text-white" style={textStyle}>
                    Join I-Robox Family
                  </p>
                  <p
                    className="text-sm text-gray-400"
                    style={textStyle ? { ...textStyle, opacity: 0.85 } : undefined}
                  >
                    Get updates on new arrivals, offers &amp; more.
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2 md:mx-8">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter your email"
                  className="w-full rounded-lg bg-white px-4 py-3 text-sm text-dark outline-none focus:ring-2 focus:ring-blue/40"
                  autoComplete="email"
                  disabled={loading}
                />
                {error ? <p className="text-sm text-red-400">{error}</p> : null}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full shrink-0 rounded-lg bg-blue px-6 py-3 text-sm font-semibold text-white hover:bg-blue-dark disabled:opacity-60 md:w-auto"
              >
                {loading ? "Subscribing…" : "Subscribe"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
