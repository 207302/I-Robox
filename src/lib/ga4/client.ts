import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type { google } from "@google-analytics/data/build/protos/protos";
import {
  formatGa4CredentialError,
  getGa4Credentials,
  isGa4Configured,
} from "./credentials";

type RunReportRequest = google.analytics.data.v1beta.IRunReportRequest;
type RunReportResponse = google.analytics.data.v1beta.IRunReportResponse;
type RunRealtimeReportRequest = google.analytics.data.v1beta.IRunRealtimeReportRequest;
type RunRealtimeReportResponse = google.analytics.data.v1beta.IRunRealtimeReportResponse;

let clientInstance: BetaAnalyticsDataClient | null = null;

export { isGa4Configured };

export function getGa4PropertyResource(): string {
  const { propertyId } = getGa4Credentials();
  return `properties/${propertyId}`;
}

export function getGa4Client(): BetaAnalyticsDataClient {
  if (clientInstance) return clientInstance;

  const { clientEmail, privateKey } = getGa4Credentials();
  clientInstance = new BetaAnalyticsDataClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });

  return clientInstance;
}

export function metricNumber(
  row: google.analytics.data.v1beta.IRow | null | undefined,
  index: number
): number {
  const raw = row?.metricValues?.[index]?.value;
  if (raw == null || raw === "") return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function dimensionString(
  row: google.analytics.data.v1beta.IRow | null | undefined,
  index: number
): string {
  return row?.dimensionValues?.[index]?.value?.trim() ?? "";
}

function wrapGa4Error(error: unknown, label: string): Error {
  const message = formatGa4ApiError(error);
  return new Error(`${label}: ${message}`);
}

/** Extract Google's human-readable INVALID_ARGUMENT detail from gRPC errors. */
export function formatGa4ApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  const credential = formatGa4CredentialError(error);
  if (credential !== message) return credential;

  const invalidArg = message.match(/INVALID_ARGUMENT:\s*(.+)/i);
  if (invalidArg?.[1]?.trim()) return invalidArg[1].trim();

  const removeHint = message.match(/Please remove .+? To learn more/i);
  if (removeHint) return removeHint[0].replace(/\s*To learn more.*$/i, ".");

  return message.replace(/^\d+\s+INVALID_ARGUMENT:\s*/i, "").trim() || message;
}

export async function runReport(request: Omit<RunReportRequest, "property">): Promise<RunReportResponse> {
  const client = getGa4Client();
  const property = getGa4PropertyResource();

  try {
    const [response] = await client.runReport({
      property,
      ...request,
    });
    return response;
  } catch (error) {
    throw wrapGa4Error(error, "GA4 API request failed");
  }
}

export async function runRealtimeReport(
  request: Omit<RunRealtimeReportRequest, "property">
): Promise<RunRealtimeReportResponse> {
  const client = getGa4Client();
  const property = getGa4PropertyResource();

  try {
    const [response] = await client.runRealtimeReport({
      property,
      ...request,
    });
    return response;
  } catch (error) {
    throw wrapGa4Error(error, "GA4 realtime API request failed");
  }
}
