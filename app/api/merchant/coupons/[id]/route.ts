import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";

async function ownedScope(merchantId: string, id: string) {
  return prisma.coupon.findFirst({ where: { id, merchantId } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const current = await ownedScope(merchant.id, params.id);
    if (!current) return NextResponse.json({ error: "优惠码不存在" }, { status: 404 });
    const body = await req.json();
    const productId = body.productId || null;
    const categoryId = body.categoryId || null;
    if (productId && !(await prisma.product.findFirst({ where: { id: productId, merchantId: merchant.id } }))) {
      return NextResponse.json({ error: "商品不属于当前商户" }, { status: 400 });
    }
    if (categoryId && !(await prisma.category.findFirst({ where: { id: categoryId, merchantId: merchant.id } }))) {
      return NextResponse.json({ error: "分类不属于当前商户" }, { status: 400 });
    }
    const code = String(body.code ?? current.code).trim().toUpperCase();
    const discountValue = Number(body.discountValue ?? current.discountValue);
    const discountType = body.discountType || current.discountType;
    if (!code || !Number.isFinite(discountValue) || discountValue < 0) {
      return NextResponse.json({ error: "优惠码或折扣值无效" }, { status: 400 });
    }
    if (discountType === "PERCENTAGE" && discountValue > 100) {
      return NextResponse.json({ error: "百分比折扣不能超过 100" }, { status: 400 });
    }
    const duplicate = await prisma.coupon.findFirst({ where: { code, NOT: { id: params.id } } });
    if (duplicate) return NextResponse.json({ error: "优惠码已存在" }, { status: 400 });
    const coupon = await prisma.coupon.update({ where: { id: params.id }, data: { code, discountValue, discountType, productId, categoryId } });
    return NextResponse.json(coupon);
  } catch {
    return NextResponse.json({ error: "更新优惠码失败" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  const current = await ownedScope(merchant.id, params.id);
  if (!current) return NextResponse.json({ error: "优惠码不存在" }, { status: 404 });
  if (current.isUsed) return NextResponse.json({ error: "已使用的优惠码不能删除" }, { status: 400 });
  await prisma.coupon.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
