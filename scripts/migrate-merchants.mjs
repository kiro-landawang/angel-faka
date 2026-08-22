import prismaPackage from "@prisma/client";
const { PrismaClient } = prismaPackage;
import crypto from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${key}`;
}

const adminPassword = process.env.ADMIN_PASSWORD || "change-me-before-production";

try {
  const defaultMerchant = await prisma.merchant.upsert({
    where: { slug: "angel" },
    update: { status: "APPROVED", name: "ANGEL旗舰" },
    create: {
      username: "angel-platform",
      password: hashPassword(adminPassword),
      name: "ANGEL旗舰",
      slug: "angel",
      status: "APPROVED",
    },
  });

  const merchantId = defaultMerchant.id;
  const [categories, products, licenses, orders, coupons] = await Promise.all([
    prisma.category.updateMany({ where: { merchantId: null }, data: { merchantId } }),
    prisma.product.updateMany({ where: { merchantId: null }, data: { merchantId } }),
    prisma.license.updateMany({ where: { merchantId: null }, data: { merchantId } }),
    prisma.order.updateMany({ where: { merchantId: null }, data: { merchantId } }),
    prisma.coupon.updateMany({ where: { merchantId: null }, data: { merchantId } }),
  ]);

  console.log(JSON.stringify({ merchantId, categories: categories.count, products: products.count, licenses: licenses.count, orders: orders.count, coupons: coupons.count }));
} finally {
  await prisma.$disconnect();
}
