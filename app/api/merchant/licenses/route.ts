import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function GET(req: Request) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  const licenses = await prisma.license.findMany({ where: { merchantId: merchant.id, productId, status: "AVAILABLE" }, orderBy: { createdAt: "asc" }, take: 100 });
  return NextResponse.json({ licenses });
}

export async function POST(req: Request) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const body = await req.json();
    const product = await prisma.product.findFirst({ where: { id: body.productId, merchantId: merchant.id } });
    if (!product || !Array.isArray(body.codes)) return NextResponse.json({ error: "商品或卡密数据无效" }, { status: 400 });
    const codes = body.codes.map((code: unknown) => String(code).trim()).filter(Boolean);
    if (!codes.length) return NextResponse.json({ error: "没有有效卡密" }, { status: 400 });
    const result = await prisma.license.createMany({ data: codes.map((code: string) => ({ code, productId: product.id, merchantId: merchant.id, status: "AVAILABLE" })) });
    return NextResponse.json({ count: result.count });
  } catch {
    return NextResponse.json({ error: "导入卡密失败" }, { status: 400 });
  }
}
