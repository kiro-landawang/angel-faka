import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required before cleaning resale products");
}

if (!/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL)) {
  console.log("Resale product cleanup skipped: DATABASE_URL is not PostgreSQL");
  process.exit(0);
}

const prisma = new PrismaClient();

try {
  await prisma.$transaction(async (tx) => {
    const duplicateGroups = await tx.$queryRawUnsafe(`
      SELECT "merchantId", "sourceProductId", MIN("createdAt") AS "firstCreatedAt"
      FROM "Product"
      WHERE "sourceProductId" IS NOT NULL
      GROUP BY "merchantId", "sourceProductId"
      HAVING COUNT(*) > 1
    `);

    let removed = 0;
    for (const group of duplicateGroups) {
      const products = await tx.$queryRawUnsafe(
        `
          SELECT "id"
          FROM "Product"
          WHERE "merchantId" IS NOT DISTINCT FROM $1
            AND "sourceProductId" = $2
          ORDER BY "createdAt" ASC, "id" ASC
        `,
        group.merchantId,
        group.sourceProductId,
      );

      const [keeper, ...duplicates] = products;
      if (!keeper) continue;

      for (const duplicate of duplicates) {
        await tx.$executeRawUnsafe(
          `UPDATE "License" SET "productId" = $1 WHERE "productId" = $2`,
          keeper.id,
          duplicate.id,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "Order" SET "productId" = $1 WHERE "productId" = $2`,
          keeper.id,
          duplicate.id,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "Order" SET "sourceProductId" = $1 WHERE "sourceProductId" = $2`,
          keeper.id,
          duplicate.id,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "Coupon" SET "productId" = $1 WHERE "productId" = $2`,
          keeper.id,
          duplicate.id,
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM "Product" WHERE "id" = $1`,
          duplicate.id,
        );
        removed += 1;
      }
    }

    console.log(`Resale product cleanup complete: removed ${removed} duplicate product(s)`);
  });
} finally {
  await prisma.$disconnect();
}
