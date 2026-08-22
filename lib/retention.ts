import { prisma } from "./prisma";
import { logger } from "./logger";

const RETENTION_DAYS = 14;

/**
 * Remove customer/order records older than the configured retention period.
 * License rows are detached first so sold inventory cannot block deletion.
 */
export async function purgeExpiredRecords(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const expiredOrders = await prisma.order.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true },
  });

  if (expiredOrders.length > 0) {
    const orderIds = expiredOrders.map((order) => order.id);
    await prisma.$transaction([
      prisma.license.updateMany({
        where: { orderId: { in: orderIds } },
        data: { orderId: null },
      }),
      prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    ]);
  }

  // Used coupons may contain an order reference and customer purchase timing.
  await prisma.coupon.deleteMany({
    where: {
      isUsed: true,
      usedAt: { lt: cutoff },
    },
  });

  logger.info({ deletedOrders: expiredOrders.length }, "Retention purge completed");
  return { deletedOrders: expiredOrders.length, cutoff };
}
