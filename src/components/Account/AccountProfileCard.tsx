"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { validateCommonEmailProvider } from "@/lib/validateEmai";

type Props = {
  initialName: string | null;
  initialEmail: string | null;
  signedInWithGoogle?: boolean;
};

export default function AccountProfileCard({
  initialName,
  initialEmail,
  signedInWithGoogle = false,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [otp, setOtp] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const isEmailChange = Boolean(initialEmail);

  function resetEmailOtpState() {
    setOtp("");
    setOtpSentTo(null);
    setDevOtpHint(null);
    setPendingEmail(null);
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter your name");
      return;
    }
    setNameLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update name");
      setName(typeof data?.name === "string" ? data.name : trimmed);
      setEditingName(false);
      toast.success("Name updated");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setNameLoading(false);
    }
  }

  async function handleSendEmailOtp() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Enter your new email");
      return;
    }
    if (!validateCommonEmailProvider(trimmed)) {
      toast.error("Use a common email provider (Gmail, Yahoo, Outlook, etc.)");
      return;
    }
    if (trimmed === (initialEmail ?? "").trim().toLowerCase()) {
      toast.error("Enter a different email address");
      return;
    }

    setEmailLoading(true);
    try {
      const res = await fetch("/api/account/profile/email/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not send OTP");

      setPendingEmail(trimmed);
      setOtp("");
      setOtpSentTo(typeof data?.sentTo === "string" ? data.sentTo : initialEmail);
      setDevOtpHint(typeof data?.devOtp === "string" ? data.devOtp : null);
      toast.success(
        data?.emailSent
          ? `OTP sent to ${data?.sentTo ?? initialEmail}`
          : "Use the dev OTP shown below."
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setEmailLoading(false);
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Enter your email");
      return;
    }
    if (!validateCommonEmailProvider(trimmed)) {
      toast.error("Use a common email provider (Gmail, Yahoo, Outlook, etc.)");
      return;
    }

    if (isEmailChange) {
      if (!otp.trim()) {
        toast.error("Enter the OTP sent to your current email");
        return;
      }
      if (!pendingEmail || pendingEmail !== trimmed) {
        toast.error("Send a new OTP after changing the email address");
        return;
      }
    }

    setEmailLoading(true);
    try {
      const res = await fetch("/api/account/profile/email", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          ...(isEmailChange ? { otp: otp.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update email");
      setEmail(typeof data?.email === "string" ? data.email : trimmed);
      setEditingEmail(false);
      resetEmailOtpState();
      toast.success(isEmailChange ? "Email updated" : "Email added");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-6">
      <h2 className="text-lg font-semibold text-dark">Profile</h2>

      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-gray-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-meta-3">Name</span>
            {!editingName ? (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-sm font-medium text-blue hover:underline"
              >
                Edit
              </button>
            ) : null}
          </div>
          {!editingName ? (
            <p className="mt-2 text-sm font-medium text-dark">{name.trim() || "—"}</p>
          ) : (
            <form onSubmit={saveName} className="mt-3 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={nameLoading}
                  className="inline-flex rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
                >
                  {nameLoading ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={nameLoading}
                  onClick={() => {
                    setName(initialName ?? "");
                    setEditingName(false);
                  }}
                  className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-gray-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-meta-3">Email</span>
            {!editingEmail ? (
              <button
                type="button"
                onClick={() => {
                  setEditingEmail(true);
                  resetEmailOtpState();
                }}
                className="text-sm font-medium text-blue hover:underline"
              >
                {initialEmail ? "Edit" : "Add"}
              </button>
            ) : null}
          </div>
          {!editingEmail ? (
            <>
              <p className="mt-2 text-sm font-medium text-dark">{email.trim() || "—"}</p>
              {signedInWithGoogle && initialEmail ? (
                <p className="mt-1 text-xs text-meta-4">
                  Signed in with Google. You can still change your account email with OTP
                  verification sent to your current address.
                </p>
              ) : null}
            </>
          ) : (
            <form onSubmit={saveEmail} className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-dark">
                  {isEmailChange ? "New email" : "Email"}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (pendingEmail && e.target.value.trim().toLowerCase() !== pendingEmail) {
                      resetEmailOtpState();
                    }
                  }}
                  placeholder="e.g. name@gmail.com"
                  required
                  className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                />
              </label>
              <span className="block text-xs text-meta-4">
                Use Gmail, Yahoo, Outlook, or another common provider.
              </span>

              {isEmailChange ? (
                <>
                  <p className="text-xs text-meta-3">
                    For security, the OTP is sent to your <strong>current</strong> email (
                    {initialEmail}), not the new one.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleSendEmailOtp()}
                    disabled={emailLoading || !email.trim()}
                    className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 transition disabled:opacity-60"
                  >
                    {emailLoading && !otpSentTo ? "Sending…" : "Send OTP to current email"}
                  </button>
                  {otpSentTo ? (
                    <p className="text-xs text-meta-3">OTP sent to {otpSentTo}</p>
                  ) : null}
                  {devOtpHint ? (
                    <p className="text-xs text-meta-3">Dev OTP: {devOtpHint}</p>
                  ) : null}
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-dark">Email OTP</span>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                    />
                  </label>
                </>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={emailLoading || (isEmailChange && !otpSentTo)}
                  className="inline-flex rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
                >
                  {emailLoading && (isEmailChange ? otpSentTo : true)
                    ? "Saving…"
                    : isEmailChange
                      ? "Confirm change"
                      : "Add email"}
                </button>
                {initialEmail ? (
                  <button
                    type="button"
                    disabled={emailLoading}
                    onClick={() => {
                      setEmail(initialEmail ?? "");
                      setEditingEmail(false);
                      resetEmailOtpState();
                    }}
                    className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
