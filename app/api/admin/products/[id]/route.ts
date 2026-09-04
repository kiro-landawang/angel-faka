import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { logger } from "@/lib/logger";

const log = logger.child({ module: 'AdminProduct' });

// Update Product
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { name, description, price, categoryId, isActive, deliveryFormat, allowResale, resalePrice, resaleMinPrice } = await req.json();
    const { id } = params;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price,
        categoryId,
        isActive,
        deliveryFormat,
        ...(typeof allowResale === "boolean" ? { allowResale } : {}),
        ...(resalePrice === undefined || resalePrice === "" ? {} : { resalePrice: Number(resalePrice) }),
        ...(resaleMinPrice === undefined || resaleMinPrice === "" ? {} : { resaleMinPrice: Number(resaleMinPrice) })
      }
    });
    
    log.info({ productId: id, changes: { name, price, isActive, deliveryFormat } }, "Product updated");
    return NextResponse.json(product);
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : "unknown", productId: params.id }, "Failed to update product");
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

// Delete Product
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { id } = params;

    const result = await prisma.$transaction(async (tx) => {
      // 审计：先记录该商品及其卡密数量，便于追溯
      const product = await tx.product.findUnique({
        where: { id },
        select: { name: true, _count: { select: { licenses: true } } },
      });
      if (!product) throw new Error("Product not found");

      const licenseCount = product._count.licenses;

      // 级联删除关联卡密（ licenses 表有 productId 外键，默认 Restrict 导致直接删商品失败）
      await tx.license.deleteMany({ where: { productId: id } });

      // 删除商品
      await tx.product.delete({ where: { id } });

      return { name: product.name, licenseCount };
    });

    log.info(
      { productId: id, name: result.name, deletedLicenses: result.licenseCount },
      "Product deleted"
    );
    return NextResponse.json({ success: true, deletedLicenses: result.licenseCount });
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : "unknown", productId: params.id }, "Failed to delete product");
    return NextResponse.json({ error: "Failed to delete product. Make sure to delete licenses first." }, { status: 500 });
  }
}
