import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { logger } from "@/lib/logger";

const log = logger.child({ module: 'OrderCreate' });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, quantity = 1, email, paymentMethod = "epay", couponCode, options } = body;

    log.info({ productId, quantity, paymentMethod: paymentMethod || "none" }, "Order creation attempt");

    if (!productId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.trim().toUpperCase() }
      });

      if (!coupon || coupon.isUsed || coupon.merchantId !== product.merchantId) {
        return NextResponse.json({ error: "优惠码无效或已被使用" }, { status: 400 });
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
    }

    // 3. Calculate Amount
    const price = Number(product.price);
    const totalAmount = Math.max(0, (price * quantity) - discountAmount);

    // 4. Create Order
    // Generate a simple order number
    const orderNo = `HT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const order = await prisma.$transaction(async (tx) => {
      if (validCouponId) {
        await tx.coupon.update({
          where: { id: validCouponId },
          data: { isUsed: true, usedAt: new Date() }
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
        options
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
      return NextResponse.json({ error: "Payment initialization failed: " + payError.message }, { status: 500 });
    }

  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : "unknown" }, "Order create error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
