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
          _count: { select: { licenses: { where: { status: "AVAILABLE" } } } },
        },
      },
      _count: { select: { licenses: { where: { status: "AVAILABLE" } } } },
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
    const name = String(body.name || "").trim();
    const description = body.description ? String(body.description) : null;
    const price = Number(body.price);
    const allowResale = Boolean(body.allowResale);

    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "商品名称需要 2 到 120 个字符" }, { status: 400 });
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "请输入有效的商品价格" }, { status: 400 });
    }

    const category = await getOrCreateCategory(merchant.id, merchant.slug, body.categoryId);
    if (!category) {
      return NextResponse.json({ error: "分类不存在或不属于当前商户" }, { status: 400 });
    }

    const resalePrice = allowResale
      ? optionalPrice(body.resalePrice, price)
      : null;
    const resaleMinPrice = allowResale
      ? optionalPrice(body.resaleMinPrice, resalePrice ?? price)
      : null;

    if (
      (resalePrice !== null && !Number.isFinite(resalePrice)) ||
      (resaleMinPrice !== null && !Number.isFinite(resaleMinPrice)) ||
      (resalePrice !== null && resalePrice < 0) ||
      (resaleMinPrice !== null && resaleMinPrice < 0)
    ) {
      return NextResponse.json({ error: "对接价或对外控价无效" }, { status: 400 });
    }
    if (resalePrice !== null && resaleMinPrice !== null && resalePrice > resaleMinPrice) {
      return NextResponse.json({ error: "对接价不能高于对外控价" }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        categoryId: category.id,
        merchantId: merchant.id,
        deliveryFormat: body.deliveryFormat || "SINGLE",
        allowResale,
        resalePrice,
        resaleMinPrice,
      },
    });
    return NextResponse.json(product);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "商品数据已存在，请刷新后重试" }, { status: 409 });
    }
    return NextResponse.json({ error: "创建商品失败，请检查填写内容后重试" }, { status: 400 });
  }
}

function optionalPrice(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  return Number(value);
}

async function getOrCreateCategory(merchantId: string, merchantSlug: string, categoryId: unknown) {
  if (categoryId) {
    return prisma.category.findFirst({ where: { id: String(categoryId), merchantId } });
  }

  const first = await prisma.category.findFirst({
    where: { merchantId },
    orderBy: { priority: "desc" },
  });
  if (first) return first;

  return prisma.category.create({
    data: {
      name: "默认商品",
      slug: `${merchantSlug}-default-${Date.now()}`,
      merchantId,
      priority: 0,
    },
  });
}
