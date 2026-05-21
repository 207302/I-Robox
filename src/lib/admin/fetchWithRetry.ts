/** Retry admin API calls when Neon cold-starts or the server returns 503 TIMEOUT. */
export async function fetchAdminWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { attempts?: number; delayMs?: number }
): Promise<Response> {
  const attempts = options?.attempts ?? 2;
  const delayMs = options?.delayMs ?? 2000;

  let last: Response | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await fetch(input, init);

    if (last.ok) return last;

    const retryable =
      last.status === 503 ||
      last.status === 502 ||
      last.status === 504 ||
      last.status === 429;

    if (!retryable || attempt === attempts - 1) return last;

    await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
  }

  return last ?? new Response(null, { status: 503 });
}
