import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type { google } from "@google-analytics/data/build/protos/protos";

type RunReportRequest = google.analytics.data.v1beta.IRunReportRequest;
type RunReportResponse = google.analytics.data.v1beta.IRunReportResponse;
type RunRealtimeReportRequest = google.analytics.data.v1beta.IRunRealtimeReportRequest;
type RunRealtimeReportResponse = google.analytics.data.v1beta.IRunRealtimeReportResponse;

let clientInstance: BetaAnalyticsDataClient | null = null;

export function isGa4Configured(): boolean {
  return Boolean(
    process.env.GA4_PROPERTY_ID?.trim() &&
      process.env.GA4_CLIENT_EMAIL?.trim() &&
      process.env.GA4_PRIVATE_KEY
  );
}

function getCredentials() {
  const clientEmail = process.env.GA4_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.GA4_PRIVATE_KEY;
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();

  if (!clientEmail || !privateKeyRaw || !propertyId) {
    throw new Error(
      "GA4 credentials missing. Set GA4_PROPERTY_ID, GA4_CLIENT_EMAIL, and GA4_PRIVATE_KEY in .env.local."
    );
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  return { clientEmail, privateKey, propertyId };
}

export function getGa4PropertyResource(): string {
  const { propertyId } = getCredentials();
  return `properties/${propertyId}`;
}

export function getGa4Client(): BetaAnalyticsDataClient {
  if (clientInstance) return clientInstance;

  const { clientEmail, privateKey } = getCredentials();
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
    const message = error instanceof Error ? error.message : "Unknown GA4 API error";
    throw new Error(`GA4 API request failed: ${message}`);
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
    const message = error instanceof Error ? error.message : "Unknown GA4 API error";
    throw new Error(`GA4 realtime API request failed: ${message}`);
  }
}
