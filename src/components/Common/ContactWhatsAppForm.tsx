"use client";

import { useState, type FormEvent } from "react";
import { phoneToWhatsAppHref } from "@/lib/marketing/contactPhoneUtils";

const MAX_MESSAGE = 1800;

type Props = {
  phone: string;
};

export default function ContactWhatsAppForm({ phone }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    const m = message.trim();
    if (!n) {
      setError("Please enter your name.");
      return;
    }
    if (!m) {
      setError("Please enter a message.");
      return;
    }
    const emailLine = email.trim() ? `Email: ${email.trim()}\n` : "";
    const body = `Hi i-Robox,\n\nName: ${n}\n${emailLine}\nMessage:\n${m}`.slice(0, MAX_MESSAGE);
    const href = phoneToWhatsAppHref(phone, body);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-meta-3">
        Send us a message on WhatsApp — we&apos;ll open your chat with this form filled in.
      </p>
      <div>
        <label htmlFor="contact-name" className="mb-1.5 block text-sm font-normal text-gray-6">
          Name <span className="text-red">*</span>
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 w-full rounded-lg border border-gray-3 px-4 py-2.5 text-sm text-dark placeholder:text-dark-5 focus:border-blue focus:outline-0 focus:ring-0"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="mb-1.5 block text-sm font-normal text-gray-6">
          Email <span className="text-meta-4">(optional)</span>
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 w-full rounded-lg border border-gray-3 px-4 py-2.5 text-sm text-dark placeholder:text-dark-5 focus:border-blue focus:outline-0 focus:ring-0"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-normal text-gray-6">
          Message <span className="text-red">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full resize-y rounded-lg border border-gray-3 px-4 py-3 text-sm text-dark placeholder:text-dark-5 focus:border-blue focus:outline-0 focus:ring-0"
          placeholder="How can we help?"
        />
      </div>
      {error ? <p className="text-sm text-red">{error}</p> : null}
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-lg bg-[#25D366] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
      >
        Continue on WhatsApp
      </button>
    </form>
  );
}
