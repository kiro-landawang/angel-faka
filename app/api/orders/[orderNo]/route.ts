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

export async function GET(
  req: Request,
  { params }: { params: { orderNo: string } }
) {
  const { orderNo } = params;

  // 纵深防御：订单号虽为 96 位随机不可枚举，仍限流防止批量探测
  const clientIp = getClientIP(req);
  if (!(await checkRateLimit("order_view:ip:" + clientIp, 60, 60)).allowed) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: {
        product: {
          select: { name: true, description: true, deliveryFormat: true }
        },
        licenses: {
          select: { id: true, code: true }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Security: Only expose license codes if order is PAID
    if (order.status !== "PAID") {
      // Create a sanitized order object without licenses
      const { licenses, ...safeOrder } = order;
      return NextResponse.json({ ...safeOrder, paymentMethod: order.paymentMethod, licenses: [] });
    }

    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
