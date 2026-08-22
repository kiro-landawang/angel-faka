import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { logger } from "@/lib/logger";
import { sendOrderEmail } from "@/lib/mail";

export async function GET(req: Request) {
  // EPay notifications are usually GET requests, but verify based on your gateway
  const { searchParams } = new URL(req.url);
  const data = Object.fromEntries(searchParams.entries());

  return processNotification(data, req);
}

export async function POST(req: Request) {
  // Handle POST notifications if configured
  const formData = await req.formData();
  const data = Object.fromEntries(formData.entries());
  
  return processNotification(data, req);
}

async function processNotification(data: any, req?: Request) {
  const log = logger.child({ module: 'EPayNotify' });
  log.info("Received payment callback");

  try {
    const adapter = getPaymentAdapter("epay");
    // Pass headers if available, or empty object
    const headers = req ? Object.fromEntries(req.headers.entries()) : {};
    const callbackData = await adapter.verifyCallback(data, headers);
    
    log.info("Signature verified");

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
            log.info("Order already paid, skipping idempotency check");
            return; 
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

        // --- Standard License Logic ---
        const sourceProductId = order.sourceProductId || order.productId;
        const sourceMerchantId = order.sourceMerchantId || order.merchantId;
        const licenses = await tx.license.findMany({
          where: {
            productId: sourceProductId,
            merchantId: sourceMerchantId,
            status: "AVAILABLE"
          },
          orderBy: { createdAt: 'asc' }, // FIFO: Use oldest licenses first
          take: order.quantity
        });

        if (licenses.length < order.quantity) {
          log.error({
            needed: order.quantity,
            found: licenses.length
          }, "Insufficient stock for paid order");
          // Important: in real world might need to alert admin or refund
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
            paymentMethod: "epay",
            paidAt: new Date()
          }
        });
        log.info("Order successfully fulfilled");
      });

      // Send Email Notification
      sendOrderEmail(callbackData.orderNo).catch(e => log.error({ err: e instanceof Error ? e.message : "unknown" }, "Email background task failed"));
    }

    return new NextResponse("success");
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : "unknown" }, "Payment notification processing failed");
    return new NextResponse("fail", { status: 400 });
  }
}
