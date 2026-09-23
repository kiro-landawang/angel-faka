import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const log = logger.child({ module: 'OrderCreate' });

// 全局(数据库级)限流：每个 IP 5 分钟内最多 10 次下单

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

const SUSPICIOUS_DOMAINS = new Set(["example.com", "test.com"]);

export async function POST(req: Request) {
  try {
    const clientIp = getClientIP(req);
    const body = await req.json();
    const { productId, quantity = 1, email, paymentMethod = "epay", couponCode, options } = body;

    // 从请求头推导当前站点真实域名，注入给支付适配器用于拼接回跳地址（payUrl）。
    // 这样在 Vercel / Netlify 等多部署环境下，payUrl 永远指向真正处理该请求的站点。
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const baseUrl = host ? `${proto}://${host}` : "";

    log.info({ clientIp, productId, quantity, paymentMethod: paymentMethod || "none" }, "Order creation attempt");

    if (!(await checkRateLimit("order_create:ip:" + clientIp, 10, 5 * 60)).allowed) {
      log.warn({ clientIp }, "Order creation rate limit exceeded");
      return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
    }

    if (!productId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
    }

    const emailDomain = email.split("@")[1].toLowerCase();
    if (SUSPICIOUS_DOMAINS.has(emailDomain)) {
      log.warn({ clientIp, email }, "Blocked suspicious email domain");
      return NextResponse.json({ error: "该邮箱域名无法使用" }, { status: 400 });
    }

    // 1. Check Product & Stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        merchant: { select: { id: true, status: true } },
        sourceProduct: {
          include: {
            merchant: { select: { id: true, status: true } },
            _count: { select: { licenses: { where: { status: "AVAILABLE" } } } }
          }
        },
        _count: {
          select: { licenses: { where: { status: "AVAILABLE" } } }
        }
      }
    });

    if (!product || product.merchant?.status !== "APPROVED") {
      log.warn({ productId }, "Product not found");
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const sourceProduct = product.sourceProduct;
    const sourceMerchantId = sourceProduct?.merchant?.id || product.merchant?.id || null;
    const availableStock = sourceProduct?._count.licenses ?? product._count.licenses;

    if (sourceProduct?.merchant?.status !== undefined && sourceProduct.merchant.status !== "APPROVED") {
      return NextResponse.json({ error: "货源商户已暂停经营" }, { status: 404 });
    }

    if (availableStock < quantity) {
      log.warn({ productId, requested: quantity, available: availableStock }, "Insufficient stock");
      return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
    }

    // 2. Handle Coupon
    let discountAmount = 0;
    let validCouponId = undefined;
    let coupon: any = null;

    if (couponCode) {
      coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.trim().toUpperCase() }
      });

      if (!coupon) {
        return NextResponse.json({ error: "优惠码不存在" }, { status: 400 });
      }
      if (coupon.isUsed) {
        return NextResponse.json({ error: "该优惠码已被使用" }, { status: 400 });
      }
      if (coupon.merchantId !== product.merchantId) {
        return NextResponse.json({ error: "该优惠码不适用于此商户的商品" }, { status: 400 });
      }

      // 使用次数上限检查：0 = 无限使用；已达上限则拒绝
      if (coupon.usageLimit !== 0 && (coupon.usedCount || 0) >= coupon.usageLimit) {
        return NextResponse.json({ error: "该优惠码已达到使用上限" }, { status: 400 });
      }

      // Check product binding
      if (coupon.productId && coupon.productId !== productId) {
        return NextResponse.json({ error: "该优惠码不适用于此商品" }, { status: 400 });
      }
      
      const subtotal = Number(product.price) * quantity;
      if (coupon.discountType === "PERCENTAGE") {
        discountAmount = subtotal * (Number(coupon.discountValue) / 100);
      } else {
        discountAmount = Number(coupon.discountValue);
      }
      
      validCouponId = coupon.id;

      // Order.couponId 带唯一约束：一张券只能挂在一个订单上。
      // 若之前有一次下单（未支付 / 支付初始化失败）已经占用了这张券，
      // 顾客再次下单会因唯一约束直接报错。这里先把「未支付订单」的占用释放掉。
      const holderOrder = await prisma.order.findFirst({
        where: { couponId: validCouponId },
        select: { id: true, status: true },
      });

      if (holderOrder) {
        if (holderOrder.status !== "PENDING") {
          return NextResponse.json({ error: "该优惠券已被使用" }, { status: 400 });
        }
        await prisma.$transaction([
          prisma.order.update({ where: { id: holderOrder.id }, data: { couponId: null } }),
          prisma.coupon.update({
            where: { id: validCouponId },
            data: {
              usedCount: Math.max(0, (coupon.usedCount || 0) - 1),
              isUsed: false,
              usedAt: null,
            },
          }),
        ]);
        log.info({ couponId: validCouponId, releasedOrderId: holderOrder.id }, "Released coupon held by unpaid order");
      }
    }

    // 3. Calculate Amount
    const price = Number(product.price);
    const totalAmount = Math.max(0, (price * quantity) - discountAmount);

    // 4. Create Order
    // Generate a simple order number
    const orderNo = "HT-" + randomBytes(12).toString("hex");

    const order = await prisma.$transaction(async (tx) => {
      if (validCouponId) {
        const newUsedCount = (coupon.usedCount || 0) + 1;
        // usageLimit 为 0 表示无限使用，永不标记用完；否则达到上限时置为已使用
        const reachedLimit = coupon.usageLimit !== 0 && newUsedCount >= coupon.usageLimit;
        await tx.coupon.update({
          where: { id: validCouponId },
          data: {
            usedCount: newUsedCount,
            isUsed: reachedLimit,
            usedAt: reachedLimit ? new Date() : undefined
          }
        });
      }

      return await tx.order.create({
        data: {
          orderNo,
          email,
          productId,
          merchantId: product.merchantId,
          sourceMerchantId,
          resellerMerchantId: sourceProduct ? product.merchantId : null,
          sourceProductId: sourceProduct?.id || product.id,
          resellerProfit: sourceProduct
            ? Math.max(0, Number(product.price) - Number(sourceProduct.resalePrice ?? sourceProduct.price)) * quantity
            : 0,
          quantity,
          totalAmount,
          paymentMethod,
          status: "PENDING",
          couponId: validCouponId
        }
      });
    });
    
    log.info({ orderNo, totalAmount }, "Order created in DB");

    // 5. Initiate Payment
    try {
      const adapter = getPaymentAdapter(paymentMethod);
      const paymentIntent = await adapter.createPayment(
        orderNo, 
        totalAmount, 
        `${product.name} x${quantity}`,
        { ...(options || {}), baseUrl }
      );
      
      log.info({ orderNo }, "Payment initiated");

      return NextResponse.json({ 
        success: true, 
        orderNo, 
        payUrl: paymentIntent.payUrl,
        qrCode: paymentIntent.qrCode 
      });

    } catch (payError: any) {
      log.error({ err: payError instanceof Error ? payError.message : "unknown", orderNo }, "Payment initiation failed");
      return NextResponse.json({ error: "支付初始化失败，请稍后重试或联系客服" }, { status: 500 });
    }

  } catch (error: any) {
    log.error({ err: error instanceof Error ? error.message : "unknown", code: error?.code }, "Order create error");
    let message = "Internal Server Error";
    if (error?.code === "P2002") message = "该优惠券已被其他订单占用，请稍后重试或联系客服";
    else if (error?.code === "P2025") message = "相关数据不存在，请刷新页面后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
