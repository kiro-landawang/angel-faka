import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { logger } from "@/lib/logger";
import { sendOrderEmail } from "@/lib/mail";

// 简单内存限流：每个 IP 5 分钟内最多 20 次回调（Serverless 多实例下非全局，但能挡住普通脚本）
const rateLimitMap = new Map<string, number[]>();
function isRateLimited(ip: string, limit = 20, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return recent.length > limit;
}

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = Object.fromEntries(searchParams.entries());
  return processNotification(data, req);
}

export async function POST(req: Request) {
  let data: Record<string, any> = {};
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const json = await req.json();
      data = json && typeof json === "object" ? json : {};
    } else {
      const formData = await req.formData();
      data = Object.fromEntries(formData.entries());
    }
  } catch {
    // 空请求体或非表单/JSON 内容时退化为读取查询参数
    const { searchParams } = new URL(req.url);
    data = Object.fromEntries(searchParams.entries());
  }
  return processNotification(data, req);
}

async function processNotification(data: any, req?: Request) {
  const log = logger.child({ module: 'MianQianNotify' });
  const clientIp = req ? getClientIP(req) : "unknown";
  log.info({ clientIp, raw: data }, "Received mianqian (personal QR) callback");

  if (req && isRateLimited(clientIp)) {
    log.warn({ clientIp }, "Mianqian notify rate limit exceeded");
    return new NextResponse("rate limit", { status: 429 });
  }

  try {
    const adapter = getPaymentAdapter("mianqian");
    const headers = req ? Object.fromEntries(req.headers.entries()) : {};
    const callbackData = await adapter.verifyCallback(data, headers);

    if (callbackData.status !== "PAID") {
      return new NextResponse("fail", { status: 400 });
    }

    const amount = Number(data.amount);
    if (!amount || isNaN(amount)) {
      log.error("Invalid amount in mianqian callback");
      return new NextResponse("fail", { status: 400 });
    }

    // 按金额 + 时间窗口匹配最近的待支付订单（免签标准做法）
    const windowStart = new Date(Date.now() - 15 * 60 * 1000);
    const orderNoHint = data.orderNo ? String(data.orderNo) : undefined;

    const candidates = await prisma.order.findMany({
      where: {
        status: "PENDING",
        createdAt: { gte: windowStart },
        totalAmount: { gte: amount - 0.01, lte: amount + 0.01 },
        paymentMethod: "mianqian",
        ...(orderNoHint ? { orderNo: orderNoHint } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: {
        product: { include: { sourceProduct: true } },
        sourceProduct: true,
      },
    });

    // 防止批量「伪造订单 + 刷金额」攻击：同金额同时存在多笔待支付且未提供 orderNo 时拒绝匹配
    if (!orderNoHint && candidates.length > 3) {
      log.warn({ clientIp, amount, candidateCount: candidates.length }, "Ambiguous mianqian amount: too many pending orders, require orderNo");
      return new NextResponse("ambiguous amount", { status: 400 });
    }

    log.info({ clientIp, amount, candidateCount: candidates.length, orderNos: candidates.map(o => o.orderNo) }, "Mianqian order matching result");
    if (candidates.length === 0) {
      log.warn({ amount }, "No matching pending mianqian order for amount");
      // 返回 success 以免手机端重复重试造成噪音；订单可能在别处已处理
      return new NextResponse("success");
    }

    const order = candidates[0]; // 取最早的一笔

    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: order.id } });
      if (!fresh || fresh.status === "PAID") {
        log.info({ orderNo: order.orderNo }, "Order already paid, skipping");
        return;
      }

      const sourceProductId = order.sourceProductId || order.productId;
      const sourceMerchantId = order.sourceMerchantId || order.merchantId;
      const licenses = await tx.license.findMany({
        where: {
          productId: sourceProductId,
          merchantId: sourceMerchantId,
          status: "AVAILABLE",
        },
        orderBy: { createdAt: "asc" },
        take: order.quantity,
      });

      if (licenses.length < order.quantity) {
        log.error({ needed: order.quantity, found: licenses.length }, "Insufficient stock for paid mianqian order");
        return;
      }

      const licenseIds = licenses.map((l) => l.id);
      await tx.license.updateMany({
        where: { id: { in: licenseIds } },
        data: { status: "SOLD", orderId: order.id },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paymentMethod: "mianqian",
          paidAt: new Date(),
        },
      });
      log.info({ orderNo: order.orderNo }, "Order fulfilled via mianqian");
    });

    sendOrderEmail(order.orderNo).catch((e) =>
      log.error({ err: e instanceof Error ? e.message : "unknown" }, "Email background task failed")
    );

    return new NextResponse("success");
  } catch (error) {
    if ((error as any)?.ignore) {
      // 非收款类通知（如聊天消息），直接忽略，返回 success 以免转发器重试
      return new NextResponse("success");
    }
    logger.error({ err: error instanceof Error ? error.message : "unknown" }, "Mianqian notification processing failed");
    return new NextResponse("fail", { status: 400 });
  }
}
