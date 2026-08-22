import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const current = await prisma.product.findFirst({
      where: { id: params.id, merchantId: merchant.id },
      select: { id: true, sourceProductId: true, price: true },
    });
    if (!current) return NextResponse.json({ error: "商品不存在" }, { status: 404 });

    const body = await req.json();
    const data: {
      name?: string;
      description?: string | null;
      price?: number;
      isActive?: boolean;
      allowResale?: boolean;
      resalePrice?: number | null;
      resaleMinPrice?: number | null;
    } = {};

    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description || null;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.allowResale !== undefined && !current.sourceProductId) {
      data.allowResale = Boolean(body.allowResale);
    }
    if (!current.sourceProductId && (body.resalePrice !== undefined || body.resaleMinPrice !== undefined)) {
      const resalePrice = body.resalePrice === "" || body.resalePrice == null ? null : Number(body.resalePrice);
      const resaleMinPrice = body.resaleMinPrice === "" || body.resaleMinPrice == null ? null : Number(body.resaleMinPrice);
      if ((resalePrice !== null && (!Number.isFinite(resalePrice) || resalePrice < 0)) || (resaleMinPrice !== null && (!Number.isFinite(resaleMinPrice) || resaleMinPrice < 0))) {
        return NextResponse.json({ error: "分销价格无效" }, { status: 400 });
      }
      if (resalePrice !== null && resaleMinPrice !== null && resalePrice < resaleMinPrice) {
        return NextResponse.json({ error: "对接价不能低于对外控价" }, { status: 400 });
      }
      data.resalePrice = resalePrice;
      data.resaleMinPrice = resaleMinPrice;
    }
    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "价格无效" }, { status: 400 });
      }
      if (current.sourceProductId) {
        const source = await prisma.product.findUnique({ where: { id: current.sourceProductId }, select: { price: true, resalePrice: true, resaleMinPrice: true } });
        const minimum = source ? Number(source.resaleMinPrice ?? source.resalePrice ?? source.price) : 0;
        if (source && price < minimum) {
          return NextResponse.json({ error: `代销价格不能低于货源控价 ¥${minimum.toFixed(2)}` }, { status: 400 });
        }
      }
      data.price = price;
    }

    const product = await prisma.product.update({ where: { id: params.id }, data });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "更新商品失败" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });

  const product = await prisma.product.findFirst({ where: { id: params.id, merchantId: merchant.id }, select: { id: true, sourceProductId: true } });
  if (!product) return NextResponse.json({ error: "商品不存在" }, { status: 404 });

  if (product.sourceProductId) {
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
  } else {
    await prisma.product.delete({ where: { id: product.id } });
  }
  return NextResponse.json({ success: true });
}
