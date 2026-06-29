"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { validateCommonEmailProvider } from "@/lib/validateEmai";
import { validatePassword } from "@/lib/validation/rules";
import PasswordInput from "@/components/Auth/PasswordInput";
import RecaptchaWidget, { type RecaptchaWidgetRef } from "@/components/Auth/RecaptchaWidget";
import { isRecaptchaEnabled } from "@/lib/security/recaptchaPublic";
import { AUTH_CHANGED_EVENT, markPendingLoginWelcome } from "@/lib/auth/clientSession";

type Mode = "login" | "signup" | "forgot";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_config: "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  google_state: "Sign-in session expired. Please try again.",
  google_token: "Could not complete Google sign-in. Please try again.",
  google_profile: "Could not load your Google profile. Please try again.",
  google_email: "Your Google account must have a verified email address.",
  google_link: "This email is already linked to a different Google account. Sign in with email and password instead.",
  google_failed: "Something went wrong with Google sign-in. Please try again.",
};

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [needsRecoveryEmail, setNeedsRecoveryEmail] = useState(false);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaWidgetRef>(null);

  useEffect(() => {
    recaptchaRef.current?.reset();
  }, [mode]);

  useEffect(() => {
    const err = searchParams.get("error");
    if (!err || !err.startsWith("google_")) return;
    const message = GOOGLE_ERROR_MESSAGES[err] ?? "Google sign-in failed.";
    setGoogleError(message);
    const toastTimer = window.setTimeout(() => toast.error(message), 150);
    router.replace("/login", { scroll: false });
    return () => window.clearTimeout(toastTimer);
  }, [searchParams, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const trimmedId = identifier.trim();
      if (
        mode === "signup" &&
        trimmedId.includes("@") &&
        !validateCommonEmailProvider(trimmedId.toLowerCase())
      ) {
        throw new Error("Use a common email provider (Gmail, Yahoo, Outlook, etc.)");
      }
      if (mode === "signup") {
        const passwordResult = validatePassword(password);
        if (!passwordResult.ok) throw new Error(passwordResult.error);
      }
      const recaptchaToken = recaptchaRef.current?.getToken();
      if (isRecaptchaEnabled() && !recaptchaToken) {
        throw new Error("Please complete the reCAPTCHA check.");
      }
      const loginOrSignupRoute = mode === "signup" ? "signup" : "login";
      const res = await fetch(`/api/auth/${loginOrSignupRoute}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { name, identifier: trimmedId, password, recaptchaToken }
            : { identifier: trimmedId, password, recaptchaToken }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Request failed");
      }
      if (mode === "signup") {
        if (data?.requiresOtp && typeof data?.userId === "string") {
          setPendingUserId(data.userId);
          setOtp("");
          setDevOtpHint(typeof data?.devOtp === "string" ? data.devOtp : null);
          toast.success(
            data?.emailSent
              ? "OTP sent to your email. Please verify to continue."
              : "Email is not configured. Use the dev OTP shown on screen."
          );
          return;
        }
        toast.success("Account created!");
        markPendingLoginWelcome();
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      } else {
        toast.success("Welcome back!");
        markPendingLoginWelcome();
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      }
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      recaptchaRef.current?.reset();
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestPasswordOtp() {
    if (!identifier.trim()) {
      toast.error("Enter your email or phone first");
      return;
    }

    const trimmedId = identifier.trim();
    const looksLikeEmail = trimmedId.includes("@");
    if (trimmedId && !looksLikeEmail && !recoveryEmail.trim()) {
      setNeedsRecoveryEmail(true);
      toast.error("Enter your Gmail address below to receive the OTP.");
      return;
    }

    if (needsRecoveryEmail || !looksLikeEmail) {
      const email = recoveryEmail.trim().toLowerCase();
      if (!email) {
        toast.error("Enter your Gmail address to receive the OTP");
        return;
      }
      if (!validateCommonEmailProvider(email)) {
        toast.error("Use a common email provider (Gmail, Yahoo, Outlook, etc.)");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-password-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier,
          ...(!looksLikeEmail || needsRecoveryEmail ? { recoveryEmail: recoveryEmail.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.needsRecoveryEmail) {
          setNeedsRecoveryEmail(true);
          if (typeof data?.userId === "string") setResetUserId(data.userId);
        }
        throw new Error(data?.error || "Could not send OTP");
      }
      setResetUserId(typeof data?.userId === "string" ? data.userId : null);
      setDevOtpHint(typeof data?.devOtp === "string" ? data.devOtp : null);
      setOtpSentTo(typeof data?.sentTo === "string" ? data.sentTo : null);
      setMode("forgot");
      toast.success(
        data?.emailSent
          ? `OTP sent to ${data?.sentTo ?? "your email"}.`
          : "Email is not configured. Use the dev OTP shown."
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUserId) return;
    const passwordResult = validatePassword(newPassword);
    if (!passwordResult.ok) {
      toast.error(passwordResult.error);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: resetUserId, otp, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not reset password");
      toast.success("Password updated. Please sign in.");
      setMode("login");
      setOtp("");
      setNewPassword("");
      setResetUserId(null);
      setRecoveryEmail("");
      setNeedsRecoveryEmail(false);
      setOtpSentTo(null);
      setDevOtpHint(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingUserId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: pendingUserId, otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "OTP verification failed");
      }
      toast.success("Welcome to i-Robox!");
      setPendingUserId(null);
      setOtp("");
      setDevOtpHint(null);
      markPendingLoginWelcome();
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!pendingUserId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: pendingUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Could not resend OTP");
      }
      setPendingUserId(typeof data?.userId === "string" ? data.userId : pendingUserId);
      setDevOtpHint(typeof data?.devOtp === "string" ? data.devOtp : null);
      toast.success(
        data?.emailSent
          ? "OTP resent successfully."
          : "Email is not configured. Use the dev OTP shown on screen."
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const googleHref = `/api/auth/google?next=${encodeURIComponent("/")}`;

  return (
    <section className="pt-36 pb-16 bg-gradient-to-b from-blue-50/40 to-white">
      <div className="w-full px-4 mx-auto max-w-lg sm:px-6">
        <div className="rounded-2xl border border-gray-3 bg-white p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-dark">
            {pendingUserId
              ? "Verify your account"
              : mode === "forgot"
                ? "Reset password"
                : mode === "login"
                  ? "Sign in"
                  : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-meta-3">
            {mode === "forgot"
              ? otpSentTo
                ? `Use the OTP sent to ${otpSentTo} to set a new password.`
                : "Use the OTP sent to your email to set a new password."
              : mode === "login"
                ? "Sign in to access your orders, wishlist, and faster checkout."
                : "Create an account for faster checkout and order tracking."}
          </p>

          {googleError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
            >
              {googleError}
            </div>
          ) : null}

          {!pendingUserId && mode !== "forgot" ? (
            <>
              <div className="mt-6 flex gap-2 rounded-xl bg-gray-1 p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    mode === "login"
                      ? "bg-white text-dark shadow-sm border border-gray-3"
                      : "text-meta-3 hover:text-dark"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    mode === "signup"
                      ? "bg-white text-dark shadow-sm border border-gray-3"
                      : "text-meta-3 hover:text-dark"
                  }`}
                >
                  Sign up
                </button>
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-3" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wide">
                  <span className="bg-white px-2 text-meta-4">Or continue with</span>
                </div>
              </div>

              <a
                href={googleHref}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-3 bg-white px-4 py-2.5 text-sm font-medium text-dark shadow-sm transition hover:bg-gray-1"
              >
                <GoogleMark />
                Google
              </a>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "signup" ? (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-dark">Name</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                      autoComplete="name"
                      required
                    />
                  </label>
                ) : null}

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-dark">Email or mobile number</span>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    type="text"
                    inputMode="email"
                    required
                    className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                    autoComplete="username"
                    placeholder={mode === "signup" ? "you@gmail.com or +91…" : undefined}
                  />
                  {mode === "signup" ? (
                    <span className="mt-1 block text-xs text-meta-4">
                      Use email for OTP verification; mobile creates your account right away.
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-dark">Password</span>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    required
                    minLength={8}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                  <span className="mt-1 block text-xs text-meta-4">Minimum 8 characters.</span>
                </label>

                <RecaptchaWidget ref={recaptchaRef} />

                <button
                  disabled={loading}
                  className="w-full rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-dark disabled:opacity-60"
                  type="submit"
                >
                  {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                </button>
                {mode === "login" ? (
                  <>
                    {needsRecoveryEmail || (identifier.trim() && !identifier.trim().includes("@")) ? (
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-dark">
                          Email for OTP
                        </span>
                        <input
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          placeholder="you@gmail.com"
                          autoComplete="email"
                          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                        />
                        <span className="mt-1 block text-xs text-meta-4">
                          Required for mobile-number accounts — OTP is sent here, not to your phone.
                        </span>
                      </label>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleRequestPasswordOtp}
                      disabled={loading}
                      className="w-full text-sm font-medium text-blue hover:underline disabled:opacity-60"
                    >
                      Forgot password?
                    </button>
                  </>
                ) : null}
              </form>
            </>
          ) : mode === "forgot" ? (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              {otpSentTo ? (
                <p className="text-sm text-meta-3">OTP sent to {otpSentTo}</p>
              ) : null}
              {devOtpHint ? (
                <p className="rounded-md bg-yellow-light-4 px-3 py-2 text-xs text-dark">
                  Dev OTP (email not configured): <b>{devOtpHint}</b>
                </p>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-dark">OTP</span>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  required
                  className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                  placeholder="123456"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-dark">New password</span>
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button
                disabled={loading}
                className="w-full rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-dark disabled:opacity-60"
                type="submit"
              >
                {loading ? "Updating…" : "Update password"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setMode("login");
                  setOtp("");
                  setNewPassword("");
                  setResetUserId(null);
                  setRecoveryEmail("");
                  setNeedsRecoveryEmail(false);
                  setOtpSentTo(null);
                  setDevOtpHint(null);
                }}
                className="w-full rounded-lg border border-gray-3 bg-white px-4 py-2.5 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
              >
                Back to login
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
              <h2 className="text-xl font-semibold text-dark">Verify OTP</h2>
              <p className="text-sm text-meta-3">Enter the 6-digit code sent to your email.</p>
              {devOtpHint ? (
                <p className="rounded-md bg-yellow-light-4 px-3 py-2 text-xs text-dark">
                  Dev OTP (email not configured): <b>{devOtpHint}</b>
                </p>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-dark">OTP</span>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                  placeholder="123456"
                  required
                />
              </label>
              <button
                disabled={loading}
                className="w-full rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-dark disabled:opacity-60"
                type="submit"
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleResendOtp}
                className="w-full rounded-lg border border-gray-3 bg-white px-4 py-2.5 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
              >
                Resend OTP
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setPendingUserId(null);
                  setOtp("");
                  setDevOtpHint(null);
                }}
                className="w-full rounded-lg border border-gray-3 bg-white px-4 py-2.5 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
