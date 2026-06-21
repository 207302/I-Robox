"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import toast from "react-hot-toast";
import PasswordInput from "@/components/Auth/PasswordInput";
import { validatePassword } from "@/lib/validation/rules";
import Link from "next/link";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("Missing link. Open the link from your email.");
      return;
    }
    const passwordResult = validatePassword(password);
    if (!passwordResult.ok) {
      toast.error(passwordResult.error);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password-from-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not set password");
      toast.success("Password saved. You can sign in now.");
      router.replace("/login");
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
        <p className="text-sm text-meta-3">This page needs a valid link from your email.</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-blue hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-3 bg-white p-8 shadow-sm space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-dark">Set your password</h1>
        <p className="mt-1 text-sm text-meta-3">
          Enter and confirm a new password for your account.
        </p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-dark">New password</label>
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-dark">Confirm password</label>
        <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue py-3 text-sm font-medium text-white hover:bg-blue-dark disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save password"}
      </button>
      <p className="text-center text-sm text-meta-3">
        <Link href="/login" className="text-blue hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function SetPasswordClient() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center text-sm text-meta-3">Loading…</div>
      }
    >
      <SetPasswordForm />
    </Suspense>
  );
}
