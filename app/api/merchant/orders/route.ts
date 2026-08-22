import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function GET() {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { merchantId: merchant.id },
        { sourceMerchantId: merchant.id },
        { resellerMerchantId: merchant.id },
      ],
    },
    include: { product: true, sourceProduct: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ orders });
}
