"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { validateCommonEmailProvider } from "@/lib/validateEmai";
import PasswordInput from "./PasswordInput";

type Props = {
  userId: string;
  needsRecoveryEmail?: boolean;
};

export default function ChangePasswordCard({ userId, needsRecoveryEmail = false }: Props) {
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);

  async function handleSendOtp() {
    if (needsRecoveryEmail) {
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
          userId,
          ...(needsRecoveryEmail ? { recoveryEmail: recoveryEmail.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not send OTP");
      setDevOtpHint(typeof data?.devOtp === "string" ? data.devOtp : null);
      setOtpSentTo(typeof data?.sentTo === "string" ? data.sentTo : null);
      toast.success(
        data?.emailSent
          ? `OTP sent to ${data?.sentTo ?? "your email"}.`
          : "Use the dev OTP shown."
      );
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ otp, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not change password");
      toast.success("Password changed successfully.");
      setOtp("");
      setNewPassword("");
      setDevOtpHint(null);
      setOtpSentTo(null);
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-6">
      <h2 className="text-lg font-semibold text-dark">Change password</h2>
      <p className="mt-2 text-sm text-meta-3">
        {needsRecoveryEmail
          ? "Your account was created with a mobile number only. Enter a Gmail address to receive the OTP, then set a new password."
          : "Request an OTP and use it to set a new password."}
      </p>

      {needsRecoveryEmail ? (
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-dark">Email for OTP</span>
          <input
            type="email"
            value={recoveryEmail}
            onChange={(e) => setRecoveryEmail(e.target.value)}
            placeholder="you@gmail.com"
            autoComplete="email"
            className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <span className="mt-1 block text-xs text-meta-4">
            Use Gmail, Yahoo, Outlook, or another common provider.
          </span>
        </label>
      ) : null}

      <button
        type="button"
        onClick={handleSendOtp}
        disabled={loading}
        className="mt-4 inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 transition disabled:opacity-60"
      >
        Send OTP
      </button>

      {otpSentTo ? (
        <p className="mt-3 text-xs text-meta-3">OTP sent to {otpSentTo}</p>
      ) : null}

      {devOtpHint ? (
        <p className="mt-3 rounded-md bg-yellow-light-4 px-3 py-2 text-xs text-dark">
          Dev OTP (email not configured): <b>{devOtpHint}</b>
        </p>
      ) : null}

      <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="OTP"
          required
          inputMode="numeric"
          className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
        />
        <PasswordInput
          value={newPassword}
          onChange={setNewPassword}
          placeholder="New password"
          minLength={8}
          required
          autoComplete="new-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-dark disabled:opacity-60"
        >
          {loading ? "Updating..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
