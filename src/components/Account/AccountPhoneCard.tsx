"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

type Props = {
  initialPhone: string | null;
  otpEmail: string | null;
};

export default function AccountPhoneCard({ initialPhone, otpEmail }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(!initialPhone);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  function resetOtpState() {
    setOtp("");
    setOtpSentTo(null);
    setDevOtpHint(null);
    setPendingPhone(null);
  }

  function handleCancel() {
    setPhone(initialPhone ?? "");
    setEditing(false);
    resetOtpState();
  }

  async function handleSendOtp() {
    const trimmed = phone.trim();
    if (!trimmed) {
      toast.error("Enter a mobile number");
      return;
    }
    if (!otpEmail) {
      toast.error("Add an email to your profile before changing your mobile number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/phone/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not send OTP");

      setPendingPhone(trimmed);
      setOtp("");
      setOtpSentTo(typeof data?.sentTo === "string" ? data.sentTo : otpEmail);
      setDevOtpHint(typeof data?.devOtp === "string" ? data.devOtp : null);
      toast.success(
        data?.emailSent
          ? `OTP sent to ${data?.sentTo ?? otpEmail}`
          : "Use the dev OTP shown below."
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) {
      toast.error("Enter a mobile number");
      return;
    }
    if (!otp.trim()) {
      toast.error("Enter the OTP sent to your email");
      return;
    }
    if (!pendingPhone || pendingPhone !== trimmed) {
      toast.error("Send a new OTP after changing the mobile number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/phone", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: trimmed, otp: otp.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not update phone");

      const savedPhone = typeof data?.phone === "string" ? data.phone : trimmed;
      setPhone(savedPhone);
      setEditing(false);
      resetOtpState();
      toast.success(initialPhone ? "Phone updated" : "Phone added");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-dark">Mobile number</h2>
        {!editing && initialPhone ? (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              resetOtpState();
            }}
            className="text-sm font-medium text-blue hover:underline"
          >
            Edit
          </button>
        ) : null}
      </div>

      {!editing ? (
        <p className="mt-3 text-sm font-medium text-dark">{initialPhone ?? "Not added yet"}</p>
      ) : (
        <form onSubmit={handleConfirm} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Mobile number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (pendingPhone && e.target.value.trim() !== pendingPhone) {
                  resetOtpState();
                }
              }}
              placeholder="e.g. 9961042506"
              inputMode="tel"
              autoComplete="tel"
              required
              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
            <span className="mt-1 block text-xs text-meta-4">
              Enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9). Must not
              already be linked to another account.
            </span>
          </label>

          {!otpEmail ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Add a Gmail address in Profile before you can change your mobile number.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleSendOtp()}
                disabled={loading || !phone.trim()}
                className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 transition disabled:opacity-60"
              >
                {loading && !otpSentTo ? "Sending…" : "Send OTP to email"}
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
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading || !otpEmail || !otpSentTo}
              className="inline-flex rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
            >
              {loading && otpSentTo ? "Confirming…" : initialPhone ? "Confirm change" : "Add number"}
            </button>
            {initialPhone ? (
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="inline-flex rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-meta-3 hover:text-dark transition disabled:opacity-60"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
