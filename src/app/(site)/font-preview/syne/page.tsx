import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Font preview — Syne | i-robox",
  robots: { index: false, follow: false },
};

const SYNE_WEIGHTS = [400, 500, 600, 700, 800] as const;
const SYNE = "'Syne', sans-serif";

export default function SyneFontPreviewPage() {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <section className="min-h-screen bg-white pt-28 pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-gray-3 pb-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-meta-3">
                Font preview · not live on site
              </p>
              <h1
                className="mt-2 text-3xl text-dark sm:text-4xl"
                style={{ fontFamily: SYNE, fontWeight: 700 }}
              >
                Syne
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/font-preview"
                className="rounded-lg border border-gray-3 px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
              >
                Clash Display
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-gray-3 px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1"
              >
                Back to site
              </Link>
            </div>
          </div>

          <p className="mb-12 max-w-2xl text-sm leading-relaxed text-meta-3">
            Headlines use <strong className="text-dark">Syne</strong> (Google Fonts). Body and UI
            labels stay on <strong className="text-dark">Poppins</strong>. Syne has a futuristic,
            slightly unconventional edge — bold weights work especially well for heroes.
          </p>

          <div className="relative overflow-hidden rounded-2xl border border-gray-3 bg-[#1c274c] px-8 py-14 sm:px-12 sm:py-20">
            <p
              className="text-xs uppercase tracking-[0.25em] text-white/60"
              style={{ fontFamily: SYNE, fontWeight: 500 }}
            >
              i-robox · diecast &amp; RC
            </p>
            <h2
              className="mt-4 max-w-xl text-4xl leading-[1.02] text-white sm:text-5xl md:text-6xl"
              style={{ fontFamily: SYNE, fontWeight: 800 }}
            >
              RC Toys.
              <br />
              Diecast Dreams.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-white/75">
              Premium Hot Wheels, Formula 1 models, and collectibles — delivered across India.
            </p>
            <span
              className="mt-8 inline-block rounded-lg bg-[#c41e3a] px-6 py-3 text-sm font-medium text-white"
              style={{ fontFamily: SYNE, fontWeight: 600 }}
            >
              Shop now
            </span>
          </div>

          <div className="mt-16 grid gap-10 sm:grid-cols-2">
            <div>
              <h3
                className="text-2xl text-dark"
                style={{ fontFamily: SYNE, fontWeight: 700 }}
              >
                Best Sellers
              </h3>
              <p className="mt-2 text-sm text-meta-3">Homepage rail section title</p>
            </div>
            <div>
              <h3
                className="text-2xl text-dark"
                style={{ fontFamily: SYNE, fontWeight: 700 }}
              >
                Shop Hot Wheels
              </h3>
              <p className="mt-2 text-sm text-meta-3">Category / brand page hero</p>
            </div>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              "F1 2025 Mercedes-AMG Petronas W16",
              "HW Starting Grid — Ferrari Pack of 4",
              "Bburago 1:18 LaFerrari",
            ].map((name) => (
              <div key={name} className="rounded-xl border border-gray-3 bg-gray-1 p-4">
                <div className="mb-4 aspect-square rounded-lg bg-gray-3" />
                <p
                  className="text-base leading-snug text-dark"
                  style={{ fontFamily: SYNE, fontWeight: 600 }}
                >
                  {name}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#c41e3a]">₹1,299</p>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-xl border border-gray-3 bg-white px-6 py-4">
            <p className="mb-3 text-xs uppercase tracking-wider text-meta-3">Header nav</p>
            <div
              className="flex flex-wrap gap-6 text-sm text-dark"
              style={{ fontFamily: SYNE, fontWeight: 600 }}
            >
              {["Shop", "Brands", "Categories", "About", "Contact"].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="mt-16 border-t border-gray-3 pt-12">
            <p className="mb-6 text-xs uppercase tracking-wider text-meta-3">Weight scale</p>
            <div className="space-y-4">
              {SYNE_WEIGHTS.map((w) => (
                <p
                  key={w}
                  className="text-3xl text-dark"
                  style={{ fontFamily: SYNE, fontWeight: w }}
                >
                  Syne {w} — Collect the grid.
                </p>
              ))}
            </div>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-3 p-6">
              <p className="text-xs uppercase tracking-wider text-meta-3">Current (Poppins)</p>
              <p className="mt-3 font-sans text-3xl font-semibold text-dark">
                RC Toys. Diecast Dreams.
              </p>
              <p className="mt-3 font-sans text-sm text-meta-3">
                Body and headings all use the same family today.
              </p>
            </div>
            <div className="rounded-xl border-2 border-[#c41e3a]/30 bg-red-50/30 p-6">
              <p className="text-xs uppercase tracking-wider text-[#c41e3a]">Preview (Syne)</p>
              <p
                className="mt-3 text-3xl text-dark"
                style={{ fontFamily: SYNE, fontWeight: 800 }}
              >
                RC Toys. Diecast Dreams.
              </p>
              <p className="mt-3 text-sm text-meta-3">
                Futuristic, bold headlines — body stays Poppins.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
