/** Use for interactive `$transaction` callbacks (checkout, payments). Neon pooler needs DIRECT_URL. */
export const PRISMA_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 45_000,
} as const;
