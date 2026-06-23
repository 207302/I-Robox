import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { formatGa4CredentialError, isGa4Configured } from "@/lib/ga4/credentials";
import { getRealtimeUsers } from "@/lib/ga4/queries";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isGa4Configured()) {
      return NextResponse.json(
        { error: "GA4 is not configured. Set GA4_PROPERTY_ID, GA4_CLIENT_EMAIL, and GA4_PRIVATE_KEY." },
        { status: 503 }
      );
    }

    try {
      const data = await getRealtimeUsers();
      return NextResponse.json({ data });
    } catch (error) {
      const message = formatGa4CredentialError(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
