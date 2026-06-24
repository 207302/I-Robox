"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type SetupData = {
  secret: string;
  otpauthUrl: string;
};

export default function AdminTwoFactorCard() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/2fa/status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not load 2FA status");
      setEnabled(Boolean(data.enabled));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load 2FA status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function startSetup() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/auth/2fa/setup", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not start setup");
      setSetup({ secret: data.secret, otpauthUrl: data.otpauthUrl });
      setSetupCode("");
      toast.success("Scan the key in Google Authenticator or similar");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setSaving(false);
    }
  }

  async function enableTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    if (!setup?.secret) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/auth/2fa/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: setup.secret, code: setupCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not enable 2FA");
      setSetup(null);
      setSetupCode("");
      setEnabled(true);
      toast.success("Two-factor authentication enabled");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not enable 2FA");
    } finally {
      setSaving(false);
    }
  }

  async function disableTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/auth/2fa/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not disable 2FA");
      setDisablePassword("");
      setDisableCode("");
      setEnabled(false);
      toast.success("Two-factor authentication disabled");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not disable 2FA");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-meta-3">Loading security settings…</p>;
  }

  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-dark">Two-factor authentication</h2>
        <p className="mt-1 text-sm text-meta-3">
          Use Google Authenticator, Authy, or a similar app for an extra code at admin sign-in.
        </p>
      </div>

      <p className="text-sm">
        Status:{" "}
        <span className={`font-semibold ${enabled ? "text-emerald-700" : "text-meta-3"}`}>
          {enabled ? "Enabled" : "Not enabled"}
        </span>
      </p>

      {!enabled && !setup ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void startSetup()}
          className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark disabled:opacity-60"
        >
          {saving ? "Starting…" : "Set up authenticator app"}
        </button>
      ) : null}

      {!enabled && setup ? (
        <form onSubmit={enableTwoFactor} className="space-y-4 rounded-xl border border-gray-3 bg-gray-1/40 p-4">
          <p className="text-sm text-dark">
            Add this account to your authenticator app using the secret below or the setup link.
          </p>
          <div className="rounded-lg border border-gray-3 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-meta-3">Secret key</p>
            <p className="mt-1 break-all font-mono text-sm text-dark">{setup.secret}</p>
          </div>
          <div className="rounded-lg border border-gray-3 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-meta-3">Setup link</p>
            <p className="mt-1 break-all text-xs text-meta-3">{setup.otpauthUrl}</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">6-digit code from app</span>
            <input
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              required
              className="w-full max-w-xs rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              placeholder="123456"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark disabled:opacity-60"
            >
              {saving ? "Enabling…" : "Enable 2FA"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setSetup(null);
                setSetupCode("");
              }}
              className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-meta-3 hover:text-dark disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {enabled ? (
        <form onSubmit={disableTwoFactor} className="space-y-3 rounded-xl border border-gray-3 bg-gray-1/40 p-4">
          <p className="text-sm text-meta-3">Enter your password and a current authenticator code to turn off 2FA.</p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Password</span>
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              required
              className="w-full max-w-md rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dark">Authenticator code</span>
            <input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              required
              className="w-full max-w-xs rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              placeholder="123456"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            {saving ? "Disabling…" : "Disable 2FA"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
