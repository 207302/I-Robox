import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { getAdminSession } from "@/lib/auth/session";

import { assertSameOrigin } from "@/lib/security/origin";

import { cleanText, hasSuspiciousInput, readJsonBody } from "@/lib/validation/input";

import { runApiRoute } from "@/lib/api/runApiRoute";
import { revalidateShopTaxonomy } from "@/lib/cache/revalidate";

import {

  listProductSubcategoriesByCategory,

  resolveSubcategoryCategoryId,

  resolveSubcategoryCategoryIdFromBody,

  subcategoryListSelect,

} from "@/lib/admin/productSubcategories";



function isAllowed(roles: string[]) {

  return (

    roles.includes("SUPER_ADMIN") ||

    roles.includes("MANAGER") ||

    roles.includes("STAFF") ||

    roles.includes("SUPPORT")

  );

}



export async function GET(req: NextRequest) {

  return runApiRoute(async () => {

    const session = await getAdminSession();

    if (!session || !isAllowed(session.roles)) {

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    }



    const categoryId =

      req.nextUrl.searchParams.get("category_id") ??

      req.nextUrl.searchParams.get("categoryId");

    const typeId =

      req.nextUrl.searchParams.get("type_id") ?? req.nextUrl.searchParams.get("typeId");



    const resolvedCategoryId = await resolveSubcategoryCategoryId(categoryId, typeId);

    if (!resolvedCategoryId) {

      return NextResponse.json({ error: "category_id query required" }, { status: 400 });

    }



    try {

      const rows = await listProductSubcategoriesByCategory(resolvedCategoryId);

      return NextResponse.json(rows);

    } catch (err) {

      console.error("[product-subtypes GET]", err);

      return NextResponse.json({ error: "Internal server error" }, { status: 500 });

    }

  });

}



export async function POST(req: NextRequest) {

  return runApiRoute(async () => {

    try {

      assertSameOrigin(req);

    } catch {

      return NextResponse.json({ error: "Bad origin" }, { status: 403 });

    }

    const session = await getAdminSession();

    if (!session || !isAllowed(session.roles)) {

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    }

    const parsed = await readJsonBody(req);

    if (!parsed.ok) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const body = parsed.body;



    const category_id = await resolveSubcategoryCategoryIdFromBody(body);

    if (!category_id) {

      return NextResponse.json({ error: "category_id required" }, { status: 400 });

    }



    const name = cleanText(body.name, 120);

    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    if (hasSuspiciousInput(name)) return NextResponse.json({ error: "Invalid name" }, { status: 400 });



    const cat = await prisma.categories.findUnique({ where: { id: category_id }, select: { id: true } });

    if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 400 });



    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    if (!baseSlug) return NextResponse.json({ error: "Invalid slug from name" }, { status: 400 });

    const existing = await prisma.product_subtypes.findFirst({ where: { slug: baseSlug } });

    const finalSlug = existing ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}` : baseSlug;

    const sort_order = Number(body.sort_order);



    const row = await prisma.product_subtypes.create({

      data: {

        category_id,

        product_type_id: null,

        name,

        slug: finalSlug,

        is_active: body.is_active === undefined ? true : Boolean(body.is_active),

        sort_order: Number.isFinite(sort_order) ? sort_order : 0,

      },

      select: subcategoryListSelect,

    });

    revalidateShopTaxonomy();
    return NextResponse.json(row, { status: 201 });

  });

}

