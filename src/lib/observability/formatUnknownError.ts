/** Serialize errors for structured logs (Error objects stringify as `{}`). */
export function formatUnknownError(err: unknown): {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
  response?: string;
} {
  if (err instanceof Error) {
    const extra = err as Error & { code?: string; response?: string };
    return {
      message: extra.message,
      name: extra.name,
      stack: extra.stack?.split("\n").slice(0, 4).join("\n"),
      ...(extra.code ? { code: String(extra.code) } : {}),
      ...(extra.response ? { response: String(extra.response).slice(0, 500) } : {}),
    };
  }
  if (typeof err === "object" && err) {
    try {
      return { message: JSON.stringify(err).slice(0, 500) };
    } catch {
      return { message: String(err) };
    }
  }
  return { message: String(err ?? "unknown error") };
}
