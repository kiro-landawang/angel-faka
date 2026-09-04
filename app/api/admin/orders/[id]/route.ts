import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { sendOrderEmail } from "@/lib/mail";

// Manual Actions (e.g., Mark as Paid)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

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
