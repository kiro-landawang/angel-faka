import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIP(req);
    // 防优惠券爆破：每 IP 5 分钟内最多 20 次校验
    if (!(await checkRateLimit("coupon_validate:ip:" + clientIp, 20, 5 * 60)).allowed) {
      return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
    }

    const { code, productId } = await req.json();

    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }
    if (!productId || typeof productId !== "string") {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() }
    });

    if (!coupon) {
      return NextResponse.json({ error: "无效的优惠码" }, { status: 404 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { merchantId: true, categoryId: true } });
    if (!product || coupon.merchantId !== product.merchantId) {
      return NextResponse.json({ error: "无效的优惠码" }, { status: 404 });
    }

    // usageLimit === 0 表示「无限使用」，这类券永不被 isUsed 拦截（含历史脏数据）
    if (coupon.isUsed && coupon.usageLimit !== 0) {
      return NextResponse.json({ error: "该优惠码已被使用" }, { status: 400 });
    }

    // 使用次数上限检查：usageLimit 为 0 表示无限使用，永不拦截；否则已用尽则拦截
    if (coupon.usageLimit !== 0 && (coupon.usedCount || 0) >= coupon.usageLimit) {
      return NextResponse.json({ error: "该优惠码已达到使用上限" }, { status: 400 });
    }

    // Check if coupon is bound to a specific product
    if (coupon.productId && coupon.productId !== productId) {
      return NextResponse.json({ error: "该优惠码不适用于此商品" }, { status: 400 });
    }

    // Check if coupon is bound to a specific category
    if (coupon.categoryId && product.categoryId !== coupon.categoryId) {
      return NextResponse.json({ error: "该优惠码不适用于此分类下的商品" }, { status: 400 });
    }

    return NextResponse.json({
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    });

  } catch (error) {
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
