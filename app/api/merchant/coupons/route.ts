import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function GET() {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  const coupons = await prisma.coupon.findMany({ where: { merchantId: merchant.id }, include: { product: { select: { name: true } }, category: { select: { name: true } }, order: { select: { orderNo: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ coupons });
}

export async function POST(req: Request) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const body = await req.json();
    const productId = body.productId || null;
    const categoryId = body.categoryId || null;
    if (productId && !(await prisma.product.findFirst({ where: { id: productId, merchantId: merchant.id } }))) return NextResponse.json({ error: "商品不属于当前商户" }, { status: 400 });
    if (categoryId && !(await prisma.category.findFirst({ where: { id: categoryId, merchantId: merchant.id } }))) return NextResponse.json({ error: "分类不属于当前商户" }, { status: 400 });
    const code = String(body.code || "").trim().toUpperCase();
    const discountValue = Number(body.discountValue);
    const discountType = body.discountType || "FIXED";
    if (!code || !Number.isFinite(discountValue) || discountValue < 0) return NextResponse.json({ error: "优惠码或折扣值无效" }, { status: 400 });
    if (discountType === "PERCENTAGE" && discountValue > 100) return NextResponse.json({ error: "百分比折扣不能超过 100" }, { status: 400 });
    if (await prisma.coupon.findUnique({ where: { code } })) return NextResponse.json({ error: "优惠码已存在" }, { status: 400 });
    const coupon = await prisma.coupon.create({ data: { code, discountValue, discountType, productId, categoryId, merchantId: merchant.id } });
    return NextResponse.json(coupon);
  } catch {
    return NextResponse.json({ error: "创建优惠码失败" }, { status: 400 });
  }
}
