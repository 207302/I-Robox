import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/rbac";
import { getGa4ConfigDiagnostics } from "@/lib/ga4/credentials";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function GET() {
  return runApiRoute(async () => {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(getGa4ConfigDiagnostics());
  });
}
