import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getCustomer } from "@/lib/customer-auth";
import { ensureLotterySchema } from "@/lib/db-migrate";
import { checkRateLimit } from "@/lib/rate-limit";
import { newId } from "@/lib/lottery";
import { prisma } from "@/lib/prisma";
import { sendOrderEmail } from "@/lib/mail";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "PointsRedeem" });

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function POST(req: Request) {
  const clientIp = getClientIP(req);
  if (!(await checkRateLimit("points_redeem:ip:" + clientIp, 20, 5 * 60)).allowed) {
    return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  }

  await ensureLotterySchema();
  const customer = await getCustomer();
  if (!customer) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: "缺少商品参数" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: {
          merchant: { select: { id: true, status: true } },
        },
      });

      if (!product || !product.isActive || product.merchant?.status !== "APPROVED") {
        return { error: "商品不存在或已下架", status: 404 };
      }
      if (!product.isRedeemable || !(product.redeemCost ?? 0) || product.redeemCost! <= 0) {
        return { error: "该商品暂不支持积分兑换", status: 400 };
      }
      if (customer.points < product.redeemCost!) {
        return { error: "积分不足", status: 400 };
      }

      // FIFO 取一张可用卡密
      const license = await tx.license.findFirst({
        where: { productId, status: "AVAILABLE" },
        orderBy: { createdAt: "asc" },
      });
      if (!license) {
        return { error: "库存不足，请联系客服补货", status: 400 };
      }

      const newPoints = customer.points - product.redeemCost!;
      await tx.customer.update({
        where: { id: customer.id },
        data: { points: { decrement: product.redeemCost! } },
      });

      await tx.pointLedger.create({
        data: {
          id: newId(),
          customerId: customer.id,
          type: "redeem",
          amount: -product.redeemCost!,
          balanceAfter: newPoints,
          ref: productId,
        },
      });

      await tx.license.update({
        where: { id: license.id },
        data: { status: "SOLD", orderId: "" },
      });

      // 记入订单以便后台对账（积分兑换订单，金额 0）
      const orderNo = "HT-" + randomBytes(12).toString("hex");
      const order = await tx.order.create({
        data: {
          orderNo,
          email: customer.email,
          productId,
          merchantId: product.merchantId,
          totalAmount: 0,
          status: "PAID",
          paymentMethod: "points",
          customerId: customer.id,
          quantity: 1,
          paidAt: new Date(),
        },
      });

      await tx.license.update({
        where: { id: license.id },
        data: { orderId: order.id },
      });

      return {
        error: null,
        status: 200,
        code: license.code,
        productName: product.name,
        pointsBalance: newPoints,
        orderNo,
      };
    });

    if ((result as any).error) {
      return NextResponse.json(
        { error: (result as any).error },
        { status: (result as any).status || 400 }
      );
    }

    const r = result as any;
    log.info({ customerId: customer.id, productId, orderNo: r.orderNo }, "Points redeem done");
    // 异步发送兑换卡密邮件（非阻塞）
    sendOrderEmail(r.orderNo).catch((e) =>
      log.error({ err: e instanceof Error ? e.message : "unknown" }, "Redeem email failed")
    );
    return NextResponse.json({
      success: true,
      code: r.code,
      productName: r.productName,
      pointsBalance: r.pointsBalance,
      orderNo: r.orderNo,
    });
  } catch (error: any) {
    log.error({ err: error?.message || "unknown" }, "Points redeem error");
    return NextResponse.json({ error: "兑换失败，请稍后重试" }, { status: 500 });
  }
}
