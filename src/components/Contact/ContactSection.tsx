"use client";

import { useState, type FormEvent } from "react";
import { phoneToWhatsAppHref } from "@/lib/marketing/contactPhoneUtils";
import {
  MAX_CONTACT_MESSAGE_LENGTH,
  validateContactMessage,
  validateEmailAddress,
  validateOptionalIndianMobile,
  validateRequiredText,
} from "@/lib/validation/rules";

const MAX_MESSAGE = MAX_CONTACT_MESSAGE_LENGTH;

const HELP_TOPICS = [
  "Product inquiries",
  "Order tracking",
  "Return & refund requests",
  "Bulk purchase queries",
  "General feedback",
  "Ad & collaboration requests",
] as const;

const inputClassName =
  "h-12 w-full rounded-lg border border-gray-3 bg-white px-4 text-sm text-dark placeholder:text-dark-5 focus:border-blue focus:outline-0 focus:ring-0";

type Props = {
  phone: string;
  cmsHtml?: string;
};

export default function ContactSection({ phone, cmsHtml }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneField, setPhoneField] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const nameResult = validateRequiredText(name, 150, "Name");
    const emailResult = validateEmailAddress(email, { commonProviderOnly: false });
    const phoneResult = validateOptionalIndianMobile(phoneField);
    const messageResult = validateContactMessage(message);
    if (!nameResult.ok) {
      setError(nameResult.error);
      return;
    }
    if (!emailResult.ok) {
      setError(emailResult.error);
      return;
    }
    if (!phoneResult.ok) {
      setError(phoneResult.error);
      return;
    }
    if (!messageResult.ok) {
      setError(messageResult.error);
      return;
    }
    const phoneLine = phoneResult.value ? `Phone: ${phoneResult.value}\n` : "";
    const body =
      `Hi i-Robox,\n\nName: ${nameResult.value}\nEmail: ${emailResult.value}\n${phoneLine}\nMessage:\n${messageResult.value}`.slice(
        0,
        MAX_MESSAGE
      );
    const href = phoneToWhatsAppHref(phone, body);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-6 sm:p-8 lg:p-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12 xl:gap-16">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red">Send us a message</p>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-dark sm:text-3xl lg:text-[2rem]">
            Have a custom request?
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-meta-3 sm:text-base">
            We&apos;d love to hear from you. Fill out the form and our team will get back to you as
            soon as possible. Whether you need help with an order, product information, or have a
            special request — we&apos;re here to help.
          </p>

          {cmsHtml ? (
            <div
              className="prose prose-neutral mt-5 max-w-none text-sm leading-relaxed text-meta-3 prose-p:text-meta-3 prose-li:text-meta-3 prose-a:text-blue"
              dangerouslySetInnerHTML={{ __html: cmsHtml }}
            />
          ) : null}

          <p className="mt-8 text-sm font-bold uppercase tracking-wide text-red">How can we help you?</p>
          <ul className="mt-4 space-y-2.5 text-sm text-dark sm:text-base">
            {HELP_TOPICS.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-dark" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="min-w-0">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label htmlFor="contact-name" className="mb-2 block text-sm font-medium text-dark">
                Full Name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClassName}
                placeholder="Enter your full name"
              />
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="contact-email" className="mb-2 block text-sm font-medium text-dark">
                Email Address
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClassName}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="contact-phone" className="mb-2 block text-sm font-medium text-dark">
              Phone Number
            </label>
            <input
              id="contact-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={phoneField}
              onChange={(e) => setPhoneField(e.target.value)}
              className={inputClassName}
              placeholder="Optional"
            />
          </div>

          <div className="mt-5">
            <label htmlFor="contact-message" className="mb-2 block text-sm font-medium text-dark">
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={6}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full resize-y rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark placeholder:text-dark-5 focus:border-blue focus:outline-0 focus:ring-0"
              placeholder="Tell us how we can help"
            />
          </div>

          {error ? <p className="mt-4 text-sm text-red">{error}</p> : null}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-red px-8 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-red-dark sm:px-10 sm:text-sm"
            >
              Send message
            </button>
          </div>
          <p className="mt-3 text-right text-xs text-meta-4">
            Submitting opens WhatsApp with your message pre-filled.
          </p>
        </form>
      </div>
    </div>
  );
}
