import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { code, discountValue, discountType, productId, categoryId, isUsed, usageLimit } = await req.json();
    const { id } = params;

    const data: any = {
      code: code?.trim().toUpperCase(),
      discountValue: discountValue ? parseFloat(discountValue) : undefined,
      discountType,
      productId: productId === undefined ? undefined : productId,
      categoryId: categoryId === undefined ? undefined : categoryId,
      isUsed
    };
    if (usageLimit !== undefined) {
      const parsed = parseInt(usageLimit, 10);
      data.usageLimit = Number.isNaN(parsed) ? 1 : Math.max(0, parsed);
      // 改为「无限使用」时，清除已使用标记（无限券永不应被标记用完）
      if (data.usageLimit === 0) {
        data.isUsed = false;
      }
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data
    });

    return NextResponse.json(coupon);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    await prisma.coupon.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
