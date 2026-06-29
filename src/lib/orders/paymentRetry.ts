export const PAYMENT_RETRY_MAX_ATTEMPTS = 3;

export type PaymentRetryState = {
  attempts: number;
  maxAttempts: number;
  canRetry: boolean;
  retriesRemaining: number;
};

export function getPaymentRetryState(attempts: number): PaymentRetryState {
  const safe = Math.max(0, Math.floor(attempts));
  const retriesRemaining = Math.max(0, PAYMENT_RETRY_MAX_ATTEMPTS - safe);
  return {
    attempts: safe,
    maxAttempts: PAYMENT_RETRY_MAX_ATTEMPTS,
    canRetry: retriesRemaining > 0,
    retriesRemaining,
  };
}

export function orderEligibleForPaymentRetry(input: {
  status: string;
  paymentStatus: string;
  paymentRetryAttempts: number;
}): boolean {
  if (input.status !== "PAYMENT_FAILED" || input.paymentStatus !== "FAILED") return false;
  return getPaymentRetryState(input.paymentRetryAttempts).canRetry;
}

export function formatCustomerOrderStatus(status: string, paymentStatus: string): string {
  if (status === "PAYMENT_FAILED" || paymentStatus === "FAILED") return "Payment failed";
  return status.replace(/_/g, " ");
}

export function formatCustomerPaymentStatus(paymentStatus: string): string {
  if (paymentStatus === "FAILED") return "Failed";
  if (paymentStatus === "SUCCEEDED") return "Paid";
  if (paymentStatus === "PENDING") return "Pending";
  return paymentStatus.replace(/_/g, " ");
}
