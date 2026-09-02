import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { logger } from "@/lib/logger";
import { sendOrderEmail } from "@/lib/mail";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = Object.fromEntries(searchParams.entries());
  return processNotification(data, req);
}

export async function POST(req: Request) {
  // 码支付异步通知为 POST 表单
  let data: Record<string, any> = {};
  try {
    const formData = await req.formData();
    data = Object.fromEntries(formData.entries());
  } catch {
    // 空请求体或非表单内容时退化为读取查询参数
    const { searchParams } = new URL(req.url);
    data = Object.fromEntries(searchParams.entries());
  }
  return processNotification(data, req);
}

async function processNotification(data: any, req?: Request) {
  const log = logger.child({ module: 'CodePayNotify' });
  log.info("Received codepay callback");

  try {
    const adapter = getPaymentAdapter("codepay");
    const headers = req ? Object.fromEntries(req.headers.entries()) : {};
    const callbackData = await adapter.verifyCallback(data, headers);

    log.info({ orderNo: callbackData.orderNo }, "Signature verified");

    if (callbackData.status === "PAID") {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { orderNo: callbackData.orderNo },
          include: {
            product: { include: { sourceProduct: true } },
            sourceProduct: true,
          }
        });

        if (!order) {
          log.error("Order not found");
          throw new Error("Order not found");
        }

        if (order.status === "PAID") {
          log.info("Order already paid, skipping");
          return;
        }

        // 金额核对：通知金额必须与订单金额一致（容差 0.01 元）
        const notifyMoney = Number(data.money);
        if (data.money !== undefined && Math.abs(notifyMoney - Number(order.totalAmount)) > 0.01) {
          log.error({ notifyMoney, orderAmount: order.totalAmount }, "Amount mismatch in codepay callback");
          throw new Error("金额不匹配");
        }

        // Check for expiration (30 mins)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        if (order.createdAt < thirtyMinutesAgo) {
          log.warn("Payment received for expired order");
          await tx.order.update({
            where: { id: order.id },
            data: { status: "EXPIRED" }
          });
          return;
        }

        // --- License fulfillment (supports resale orders) ---
        const sourceProductId = order.sourceProductId || order.productId;
        const sourceMerchantId = order.sourceMerchantId || order.merchantId;
        const licenses = await tx.license.findMany({
          where: {
            productId: sourceProductId,
            merchantId: sourceMerchantId,
            status: "AVAILABLE"
          },
          orderBy: { createdAt: 'asc' },
          take: order.quantity
        });

        if (licenses.length < order.quantity) {
          log.error({
            needed: order.quantity,
            found: licenses.length
          }, "Insufficient stock for paid order");
          return;
        }

        const licenseIds = licenses.map(l => l.id);
        await tx.license.updateMany({
          where: { id: { in: licenseIds } },
          data: { status: "SOLD", orderId: order.id }
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            paymentMethod: "codepay",
            paidAt: new Date()
          }
        });
        log.info("Order successfully fulfilled via codepay");
      });

      // Send Email Notification
      sendOrderEmail(callbackData.orderNo).catch(e => log.error({ err: e instanceof Error ? e.message : "unknown" }, "Email background task failed"));
    }

    return new NextResponse("success");
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : "unknown" }, "Codepay notification processing failed");
    return new NextResponse("fail", { status: 400 });
  }
}
