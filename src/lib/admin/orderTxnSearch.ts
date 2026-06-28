/** True when the query looks like a Razorpay payment/refund ID or long transaction token. */
export function looksLikeTxnId(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (q.startsWith("pay_") || q.startsWith("rfnd_")) return true;
  return q.length >= 20 && !/\s/.test(q);
}
