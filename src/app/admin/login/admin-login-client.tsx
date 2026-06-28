"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  next: string;
};

export default function AdminLoginClient({ next }: Props) {
  const router = useRouter();

  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [challenge, setChallenge] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Invalid credentials");
        return;
      }
      if (data?.requiresTotp && typeof data?.challenge === "string") {
        setChallenge(data.challenge);
        setTotpCode("");
        setStep("totp");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth/verify-totp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge, code: totpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Invalid authenticator code");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#0f172a" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: "#c41e3a" }}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold" style={{ color: "#f1f5f9" }}>
            {step === "totp" ? "Authenticator code" : "Admin access"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#94a3b8" }}>
            {step === "totp"
              ? "Enter the 6-digit code from your authenticator app"
              : "Authorised personnel only"}
          </p>
        </div>

        {error ? (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{
              background: "rgba(220,38,38,0.12)",
              border: "1px solid rgba(220,38,38,0.25)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        ) : null}

        {step === "credentials" ? (
          <form onSubmit={submitCredentials} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium" style={{ color: "#cbd5e1" }}>
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#f1f5f9",
                }}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium" style={{ color: "#cbd5e1" }}>
                Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    color: "#f1f5f9",
                  }}
                  className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ color: "#94a3b8" }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <button
              disabled={loading}
              style={{ background: "#c41e3a" }}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitTotp} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium" style={{ color: "#cbd5e1" }}>
                6-digit code
              </span>
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                required
                autoComplete="one-time-code"
                placeholder="123456"
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#f1f5f9",
                }}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 tracking-widest"
              />
            </label>

            <button
              disabled={loading}
              style={{ background: "#c41e3a" }}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify and sign in"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setStep("credentials");
                setChallenge("");
                setTotpCode("");
                setError("");
              }}
              className="w-full text-sm font-medium hover:underline disabled:opacity-60"
              style={{ color: "#94a3b8" }}
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
