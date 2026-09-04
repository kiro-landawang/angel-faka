import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { sendOrderEmail } from "@/lib/mail";

// 同一管理员 IP 15 分钟内最多 30 次手动操作，挡住被盗会话的批量刷单
const markPaidHits = new Map<string, number[]>();
function markPaidRateLimited(ip: string) {
  const now = Date.now();
  const arr = (markPaidHits.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  arr.push(now);
  markPaidHits.set(ip, arr);
  return arr.length > 30;
}

// Manual Actions (e.g., Mark as Paid)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    console.warn(`[AUDIT] Unauthenticated PATCH on admin order ${params.id} from IP ${ip}`);
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (markPaidRateLimited(clientIp)) {
    console.warn(`[AUDIT] MARK_PAID rate-limited for IP ${clientIp}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { action } = await req.json(); // "MARK_PAID"
    const { id } = params;

    const order = await prisma.order.findUnique({ 
      where: { id },
      include: { product: true, sourceProduct: true }
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (action === "MARK_PAID") {
       if (order.status === "PAID") return NextResponse.json({ error: "Already paid" }, { status: 400 });

       // 审计日志：谁、从哪个 IP、哪个订单被手动标记为已支付
       console.warn(`[AUDIT] Manual MARK_PAID by admin from IP ${clientIp} for order ${order.orderNo} (id=${id})`);

       // Transactional manual fulfillment
       await prisma.$transaction(async (tx) => {
         
         // Use the source product for reseller orders; keep legacy orders compatible.
         const sourceProductId = order.sourceProductId || order.productId;
         const sourceMerchantId = order.sourceMerchantId || order.merchantId;
         const licenses = await tx.license.findMany({
           where: { productId: sourceProductId, merchantId: sourceMerchantId, status: "AVAILABLE" },
           orderBy: { createdAt: 'asc' }, // FIFO: Use oldest licenses first
           take: order.quantity
         });

         if (licenses.length < order.quantity) {
           throw new Error("Insufficient stock to fulfill manually");
         }

         const licenseIds = licenses.map(l => l.id);
         await tx.license.updateMany({
           where: { id: { in: licenseIds } },
           data: { status: "SOLD", orderId: order.id }
         });

         // Update Order
         await tx.order.update({
           where: { id },
           data: { 
             status: "PAID", 
             paidAt: new Date(),
             paymentMethod: "manual"
           }
         });
       });

       // Trigger email notification in background
       sendOrderEmail(order.orderNo).catch(console.error);

       return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Operation failed" }, { status: 500 });
  }
}
