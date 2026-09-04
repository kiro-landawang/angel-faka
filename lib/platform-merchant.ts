import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

let migrationPromise: Promise<string | null> | null = null;

async function findAndRepairDefaultMerchant() {
  // The platform merchant is required by the public storefront. Create it lazily
  // so an existing Neon database is repaired on the first authenticated or public request.
  const existing = await prisma.merchant.findUnique({
    where: { slug: "angel" },
    select: { id: true, status: true },
  });

  const merchant = existing
    ? existing.status === "APPROVED"
      ? existing
      : await prisma.merchant.update({
          where: { id: existing.id },
          data: { status: "APPROVED", name: "ANGEL旗舰" },
          select: { id: true, status: true },
        })
    : await prisma.merchant.create({
        data: {
          username: "angel-platform",
          password: await hashPassword(
            process.env.ADMIN_PASSWORD || randomBytes(32).toString("hex")
          ),
          name: "ANGEL旗舰",
          slug: "angel",
          status: "APPROVED",
        },
        select: { id: true, status: true },
      });

  // A healthy database already has every record assigned. Avoid five writes on
  // every public request; only run this legacy migration when an orphan exists.
  const orphanedCategory = await prisma.category.findFirst({
    where: { merchantId: null },
    select: { id: true },
  });
  if (orphanedCategory) {
    await prisma.$transaction([
      prisma.category.updateMany({ where: { merchantId: null }, data: { merchantId: merchant.id } }),
      prisma.product.updateMany({ where: { merchantId: null }, data: { merchantId: merchant.id } }),
      prisma.license.updateMany({ where: { merchantId: null }, data: { merchantId: merchant.id } }),
      prisma.order.updateMany({ where: { merchantId: null }, data: { merchantId: merchant.id } }),
      prisma.coupon.updateMany({ where: { merchantId: null }, data: { merchantId: merchant.id } }),
    ]);
  }

  return merchant.id;
}

export async function getDefaultMerchantId() {
  migrationPromise ??= findAndRepairDefaultMerchant().finally(() => {
    migrationPromise = null;
  });
  return migrationPromise;
}
