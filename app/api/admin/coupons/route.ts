import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { getDefaultMerchantId } from "@/lib/platform-merchant";

export async function GET(req: Request) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  const [coupons, total] = await prisma.$transaction([
    prisma.coupon.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { 
        order: { select: { orderNo: true } },
        product: { select: { name: true } },
        category: { select: { name: true } }
      }
    }),
    prisma.coupon.count()
  ]);

  return NextResponse.json({
    items: coupons,
    total
  });
}

export async function POST(req: Request) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { code, discountValue, discountType, productId, categoryId, usageLimit } = await req.json();

    if (!code || !discountValue) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // usageLimit: 0 = 无限使用, 1 = 一次性（默认）, 其它正整数 = 限定次数
    const parsedLimit = parseInt(usageLimit, 10);
    const finalUsageLimit = Number.isNaN(parsedLimit) ? 1 : Math.max(0, parsedLimit);

    const product = productId ? await prisma.product.findUnique({ where: { id: productId }, select: { merchantId: true } }) : null;
    const category = categoryId ? await prisma.category.findUnique({ where: { id: categoryId }, select: { merchantId: true } }) : null;
    const coupon = await prisma.coupon.create({
      data: {
        code: code.trim().toUpperCase(),
        merchantId: product?.merchantId || category?.merchantId || await getDefaultMerchantId(),
        discountValue: parseFloat(discountValue),
        discountType: discountType || "FIXED",
        productId: productId || null,
        categoryId: categoryId || null,
        usageLimit: finalUsageLimit,
        isUsed: false
      }
    });

    return NextResponse.json(coupon);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}
