import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapDbAddressToSaved } from "@/lib/account/savedAddress";
import { parseAddressInput } from "@/lib/account/parseAddressInput";
import { isShippingAddressValid } from "@/lib/validation/address";
import { getSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { rateLimitStorefront } from "@/lib/security/rateLimit";
import { readJsonBody } from "@/lib/validation/input";
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

export async function GET() {
  return runApiRoute(async () => {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await prisma.addresses.findMany({
      where: { customer_id: session.sub },
      orderBy: [{ is_default_shipping: "desc" }, { created_at: "desc" }],
      take: 30,
      select: addressSelect,
    });

    return NextResponse.json({
      addresses: rows
        .map(mapDbAddressToSaved)
        .filter((row) =>
          isShippingAddressValid({
            full_name: row.full_name,
            phone: row.phone,
            line1: row.line1,
            line2: row.line2,
            city: row.city,
            state: row.state,
            postal_code: row.postal_code,
            country: row.country,
          })
        ),
    });
  });
}

export async function POST(req: NextRequest) {
  return runApiRoute(async () => {
    try {
      assertSameOrigin(req);
      await rateLimitStorefront(
        `account_address_post:ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
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
      await rateLimitStorefront(`account_address_post:user:${session.sub}`, 1);
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const addressParsed = parseAddressInput(parsed.body);
    if (!addressParsed.ok) {
      return NextResponse.json({ error: addressParsed.error }, { status: 400 });
    }

    const existingCount = await prisma.addresses.count({
      where: { customer_id: session.sub },
    });
    const makePrimary = existingCount === 0;

    const address = await prisma.addresses.create({
      data: {
        customer_id: session.sub,
        ...addressParsed.address,
        is_default_billing: makePrimary,
        is_default_shipping: makePrimary,
      },
      select: addressSelect,
    });

    return NextResponse.json({ ok: true, address: mapDbAddressToSaved(address) }, { status: 201 });
  });
}
