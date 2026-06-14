/** Customer-facing tracking page (shows results directly when AWB is in the URL). */
export const SHIPMOZO_PUBLIC_TRACK_BASE = "https://app.shipmozo.com/track-order";

export function shipmozoPublicTrackUrl(awbNumber: string | null | undefined): string {
  const awb = (awbNumber ?? "").trim();
  if (!awb) return SHIPMOZO_PUBLIC_TRACK_BASE;
  return `${SHIPMOZO_PUBLIC_TRACK_BASE}?awb=${encodeURIComponent(awb)}`;
}
