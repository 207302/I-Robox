import Link from "next/link";
import { phoneToWhatsAppHref } from "@/lib/marketing/contactPhoneUtils";

type Props = {
  phone: string;
};

export default function WhatsAppFloatingButton({ phone }: Props) {
  const href = phoneToWhatsAppHref(phone);

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-[60] inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:opacity-95"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-6 w-6 fill-current"
      >
        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.46 0 .12 5.34.12 11.94c0 2.1.54 4.14 1.56 5.94L0 24l6.3-1.62a11.9 11.9 0 0 0 5.76 1.44h.06c6.6 0 11.94-5.34 11.94-11.94 0-3.18-1.26-6.18-3.54-8.4zm-8.4 18.36h-.06a9.94 9.94 0 0 1-5.04-1.38l-.36-.18-3.72.96.96-3.6-.24-.36a9.97 9.97 0 0 1-1.56-5.34C2.1 6.42 6.54 1.98 12.06 1.98c2.64 0 5.16 1.02 7.02 2.88a9.86 9.86 0 0 1 2.94 7.02c0 5.52-4.44 9.96-9.9 9.96zm5.46-7.44c-.3-.18-1.74-.9-2.04-1.02-.24-.06-.48-.12-.72.18s-.84 1.02-1.08 1.2c-.18.24-.42.24-.72.12-.3-.18-1.32-.48-2.52-1.56-.9-.78-1.56-1.8-1.74-2.1-.18-.3 0-.42.12-.6.18-.18.3-.3.48-.48.12-.12.18-.3.3-.48.12-.18.06-.36 0-.54-.06-.12-.72-1.68-.96-2.34-.24-.54-.48-.48-.72-.48h-.6c-.18 0-.54.06-.78.3-.3.3-1.08 1.02-1.08 2.46 0 1.5 1.08 2.88 1.26 3.06.18.24 2.1 3.3 5.22 4.56.72.3 1.32.48 1.74.66.72.24 1.38.18 1.92.12.6-.12 1.74-.72 1.98-1.44.24-.72.24-1.32.18-1.44-.06-.12-.24-.18-.54-.3z" />
      </svg>
    </Link>
  );
}

