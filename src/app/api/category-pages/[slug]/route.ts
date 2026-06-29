import { NextResponse } from "next/server";
import { getCategoryPagePayload } from "@/lib/pages/categoryPageData";
import { runApiRoute } from "@/lib/api/runApiRoute";
import { cleanText } from "@/lib/validation/input";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  return runApiRoute(async () => {
    const { slug: rawSlug } = await ctx.params;
    const slug = cleanText(rawSlug, 160);
    if (!slug) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await getCategoryPagePayload(slug);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      category: {
        id: data.category.id,
        name: data.category.name,
        slug: data.category.slug,
        description: data.category.description,
      },
      heroImage: data.heroImage,
      stats: data.stats,
      subcategories: data.subcategories,
    });
  });
}
