import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function GET() {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  const categories = await prisma.category.findMany({ where: { merchantId: merchant.id }, orderBy: { priority: "desc" } });
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const body = await req.json();
    const category = await prisma.category.create({
      data: {
        name: String(body.name || "").trim(),
        slug: `${merchant.slug}-${String(body.slug || body.name || "category").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${Date.now()}`,
        priority: Number(body.priority || 0),
        merchantId: merchant.id,
      },
    });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "创建分类失败" }, { status: 400 });
  }
}
