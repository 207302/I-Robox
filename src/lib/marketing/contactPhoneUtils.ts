/** Pure phone/link helpers — safe for client components (no DB). */

/** `tel:` href from a display phone string (spaces stripped). */
export function phoneToTelHref(phone: string) {
  const compact = phone.replace(/\s+/g, "");
  if (!compact) return "tel:";
  return compact.startsWith("+") ? `tel:${compact}` : `tel:${compact}`;
}

/** `wa.me` href from display phone string (keeps digits only). */
export function phoneToWhatsAppHref(phone: string, message?: string) {
  const digits = phone.replace(/\D+/g, "");
  if (!digits) return "";
  const text = encodeURIComponent(message ?? "Hi! I have a question about an order / product.");
  return `https://wa.me/${digits}?text=${text}`;
}
