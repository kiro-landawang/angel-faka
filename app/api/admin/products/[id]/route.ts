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
      // 审计：先记录该商品及其关联数量
      const product = await tx.product.findUnique({
        where: { id },
        select: {
          name: true,
          _count: {
            select: {
              licenses: true,
              orders: true,
              coupons: true,
              sourceOrders: true,
              resellerProducts: true,
            },
          },
        },
      });
      if (!product) throw new Error("Product not found");

      const counts = product._count;

      // 安全策略：如果存在已支付订单，禁止删除，避免误删真实交易记录
      const paidOrders = await tx.order.count({
        where: { productId: id, status: "PAID" },
      });
      if (paidOrders > 0) {
        throw new Error(`该商品存在 ${paidOrders} 笔已支付订单，请先处理或备份后再删除`);
      }

      // 1. 级联删除卡密
      await tx.license.deleteMany({ where: { productId: id } });

      // 2. 删除该商品的未支付/失败/过期/取消订单（测试单等）
      await tx.order.deleteMany({ where: { productId: id } });

      // 3. 解除订单对该商品作为货源的关联
      await tx.order.updateMany({
        where: { sourceProductId: id },
        data: { sourceProductId: null },
      });

      // 4. 解除优惠券对该商品的关联
      await tx.coupon.updateMany({
        where: { productId: id },
        data: { productId: null },
      });

      // 5. 解除下级转售商品对该商品的货源指向
      await tx.product.updateMany({
        where: { sourceProductId: id },
        data: { sourceProductId: null },
      });

      // 6. 删除商品
      await tx.product.delete({ where: { id } });

      return { name: product.name, counts };
    });

    log.info(
      { productId: id, name: result.name, clearedCounts: result.counts },
      "Product deleted"
    );
    return NextResponse.json({ success: true, clearedCounts: result.counts });
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : "unknown", productId: params.id }, "Failed to delete product");
    return NextResponse.json(
      { error: `删除商品失败: ${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    );
  }
}
