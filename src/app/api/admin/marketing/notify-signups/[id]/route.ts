import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/lib/admin/rbac";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStrict } from "@/lib/security/rateLimit";
import { isUuid } from "@/lib/validation/input";
import { runAdminApiRoute } from "@/lib/api/runAdminApiRoute";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runAdminApiRoute(
    async () => {
      try {
        assertSameOrigin(req);
        await rateLimitStrict(`admin_notify_signup_del:${req.ip ?? "unknown"}`, 1);
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "BAD_ORIGIN") {
          return NextResponse.json({ error: "Bad origin" }, { status: 403 });
        }
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }

      const auth = await requireAdminWrite();
      if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const { id } = await ctx.params;
      if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const existing = await prisma.marketing_notify_signups.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

      await prisma.marketing_notify_signups.delete({ where: { id } });

      return NextResponse.json({ ok: true }, { status: 200 });
    },
    { name: "DELETE /api/admin/marketing/notify-signups/[id]" }
  );
}
