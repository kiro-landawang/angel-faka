import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function GET() {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  const products = await prisma.product.findMany({
    where: { merchantId: merchant.id },
    include: {
      category: true,
      sourceProduct: {
        select: {
          id: true,
          name: true,
          merchantId: true,
          price: true,
          resalePrice: true,
          resaleMinPrice: true,
          _count: { select: { licenses: { where: { status: "AVAILABLE" } } } }
        }
      },
      _count: { select: { licenses: { where: { status: "AVAILABLE" } } } }
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const body = await req.json();
    const category = await prisma.category.findFirst({ where: { id: body.categoryId, merchantId: merchant.id } });
    if (!category) return NextResponse.json({ error: "分类不存在" }, { status: 400 });
    const product = await prisma.product.create({
      data: {
        name: String(body.name || "").trim(),
        description: body.description || null,
        price: Number(body.price),
        categoryId: category.id,
        merchantId: merchant.id,
        deliveryFormat: body.deliveryFormat || "SINGLE",
        allowResale: Boolean(body.allowResale),
        resalePrice: body.resalePrice === undefined || body.resalePrice === "" ? null : Number(body.resalePrice),
        resaleMinPrice: body.resaleMinPrice === undefined || body.resaleMinPrice === "" ? null : Number(body.resaleMinPrice),
      },
    });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "创建商品失败" }, { status: 400 });
  }
}
