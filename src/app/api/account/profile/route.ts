import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStorefront } from "@/lib/security/rateLimit";
import { cleanText, hasSuspiciousInput, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

export async function PUT(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStorefront(
        `account_profile_put:ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
        1
      );
    } catch (e: any) {
      if (e?.message === "BAD_ORIGIN") {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      await rateLimitStorefront(`account_profile_put:user:${session.sub}`, 1);
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    if (parsed.body.email !== undefined) {
      return NextResponse.json(
        { error: "Use the email change flow with OTP verification." },
        { status: 400 }
      );
    }

    const current = await prisma.customers.findUnique({
      where: { id: session.sub },
      select: { name: true },
    });
    if (!current) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    if (parsed.body.name === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const name = cleanText(parsed.body.name, 150);
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (hasSuspiciousInput(name)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const updated = await prisma.customers.update({
      where: { id: session.sub },
      data: { name },
      select: { name: true },
    });

    return NextResponse.json({
      ok: true,
      name: updated.name,
    });
  });
}
