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

// 业务错误：抛出即回滚事务，由外层统一转成对应 HTTP 状态
class RedeemError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "RedeemError";
  }
}

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
        throw new RedeemError("商品不存在或已下架", 404);
      }
      if (!product.isRedeemable || !(product.redeemCost ?? 0) || product.redeemCost! <= 0) {
        throw new RedeemError("该商品暂不支持积分兑换", 400);
      }
      const cost = product.redeemCost!;

      // 1) 原子扣积分：where 带 points >= cost 守卫，并发下绝不会扣成负数
      const deducted = await tx.customer.updateMany({
        where: { id: customer.id, points: { gte: cost } },
        data: { points: { decrement: cost } },
      });
      if (deducted.count === 0) {
        throw new RedeemError("积分不足", 400);
      }

      // 2) 原子抢占一张卡密：updateMany 带 status 守卫，防止两个并发请求拿到同一张卡
      let claimedLicense: { id: string; code: string } | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = await tx.license.findFirst({
          where: { productId, status: "AVAILABLE" },
          orderBy: { createdAt: "asc" },
        });
        if (!candidate) {
          throw new RedeemError("库存不足，请联系客服补货", 400);
        }
        const claimed = await tx.license.updateMany({
          where: { id: candidate.id, status: "AVAILABLE" },
          data: { status: "SOLD" },
        });
        if (claimed.count === 1) {
          claimedLicense = { id: candidate.id, code: candidate.code };
          break;
        }
      }
      if (!claimedLicense) {
        throw new RedeemError("库存紧张，请稍后重试", 400);
      }

      // 3) 读取扣减后的真实余额，写入积分流水
      const fresh = await tx.customer.findUnique({ where: { id: customer.id } });
      const newPoints = fresh?.points ?? 0;

      await tx.pointLedger.create({
        data: {
          id: newId(),
          customerId: customer.id,
          type: "redeem",
          amount: -cost,
          balanceAfter: newPoints,
          ref: productId,
        },
      });

      // 4) 记入订单便于后台对账（金额 0，paymentMethod=points）
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
        where: { id: claimedLicense.id },
        data: { orderId: order.id },
      });

      return {
        code: claimedLicense.code,
        productName: product.name,
        pointsBalance: newPoints,
        orderNo,
      };
    });

    log.info({ customerId: customer.id, productId, orderNo: result.orderNo }, "Points redeem done");
    // 异步发送兑换卡密邮件（非阻塞）
    sendOrderEmail(result.orderNo).catch((e) =>
      log.error({ err: e instanceof Error ? e.message : "unknown" }, "Redeem email failed")
    );
    return NextResponse.json({
      success: true,
      code: result.code,
      productName: result.productName,
      pointsBalance: result.pointsBalance,
      orderNo: result.orderNo,
    });
  } catch (error: any) {
    if (error instanceof RedeemError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    log.error({ err: error?.message || "unknown" }, "Points redeem error");
    return NextResponse.json({ error: "兑换失败，请稍后重试" }, { status: 500 });
  }
}
