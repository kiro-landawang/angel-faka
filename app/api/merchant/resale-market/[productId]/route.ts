import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function POST(
  req: Request,
  { params }: { params: { productId: string } }
) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const bodySourceMerchantId = typeof body.sourceMerchantId === "string" ? body.sourceMerchantId.trim() : "";
    const source = await prisma.product.findFirst({
      where: {
        id: params.productId,
        merchantId: { not: merchant.id },
        isActive: true,
        allowResale: true,
        merchant: { status: "APPROVED" },
        ...(bodySourceMerchantId ? { merchantId: bodySourceMerchantId } : {}),
        licenses: { some: { status: "AVAILABLE" } },
      },
      include: { category: true },
    });

    if (!source) {
      return NextResponse.json({ error: "商品不可代销或当前无库存" }, { status: 404 });
    }

    const salePrice = Number(body.salePrice);
    const sourcePrice = Number(source.resalePrice ?? source.price);
    const minSalePrice = Number(source.resaleMinPrice ?? sourcePrice);

    if (!Number.isFinite(salePrice) || salePrice < minSalePrice) {
      return NextResponse.json(
        { error: `销售价格不能低于货源控价 ¥${minSalePrice.toFixed(2)}` },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findFirst({
      where: { merchantId: merchant.id, sourceProductId: source.id },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "你已经代销过这个商品" }, { status: 409 });
    }

    const product = await prisma.product.create({
      data: {
        name: source.name,
        description: source.description,
        price: salePrice,
        categoryId: await ensureResaleCategory(merchant.id, source.category.name),
        merchantId: merchant.id,
        deliveryFormat: source.deliveryFormat,
        sourceProductId: source.id,
        sourcePrice,
        allowResale: false,
      },
    });

    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "代销商品创建失败" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { productId: string } }
) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });

  const product = await prisma.product.findFirst({
    where: { id: params.productId, merchantId: merchant.id, sourceProductId: { not: null } },
    select: { id: true },
  });

  if (!product) return NextResponse.json({ error: "代销商品不存在" }, { status: 404 });

  await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}

async function ensureResaleCategory(merchantId: string, sourceName: string) {
  const slug = `resale-${merchantId}`;
  const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return existing.id;

  const category = await prisma.category.upsert({
    where: { slug },
    update: { merchantId, name: "代销商品", priority: 999 },
    create: {
      name: "代销商品",
      slug,
      merchantId,
      priority: 999,
    },
    select: { id: true },
  });
  return category.id;
}
