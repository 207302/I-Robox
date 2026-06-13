import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapDbAddressToSaved } from "@/lib/account/savedAddress";
import { parseAddressInput } from "@/lib/account/parseAddressInput";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStorefront } from "@/lib/security/rateLimit";
import { isUuid, readJsonBody } from "@/lib/validation/input";
import { runApiRoute } from "@/lib/api/runApiRoute";

const addressSelect = {
  id: true,
  full_name: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  state: true,
  postal_code: true,
  country: true,
  is_default_shipping: true,
} as const;

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStorefront(
        `account_address_put:ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
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
      await rateLimitStorefront(`account_address_put:user:${session.sub}`, 1);
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const owned = await prisma.addresses.findFirst({
      where: { id, customer_id: session.sub },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const addressParsed = parseAddressInput(parsed.body);
    if (!addressParsed.ok) {
      return NextResponse.json({ error: addressParsed.error }, { status: 400 });
    }

    const updated = await prisma.addresses.update({
      where: { id },
      data: addressParsed.address,
      select: addressSelect,
    });

    return NextResponse.json({
      ok: true,
      address: mapDbAddressToSaved(updated),
    });
  });
}
