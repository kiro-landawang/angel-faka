import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function GET(req: Request) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });

  const sourceMerchantId = new URL(req.url).searchParams.get("merchantId")?.trim();
  if (sourceMerchantId === merchant.id) return NextResponse.json({ products: [] });
  const products = await prisma.product.findMany({
    where: {
      merchantId: sourceMerchantId || { not: merchant.id },
      isActive: true,
      allowResale: true,
      merchant: { status: "APPROVED" },
      licenses: { some: { status: "AVAILABLE" } },
    },
    select: {
      id: true,
      name: true,
      price: true,
      resalePrice: true,
      resaleMinPrice: true,
      merchant: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true } },
      _count: { select: { licenses: { where: { status: "AVAILABLE" } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products });
}
