import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  const current = await prisma.category.findFirst({ where: { id: params.id, merchantId: merchant.id } });
  if (!current) return NextResponse.json({ error: "分类不存在" }, { status: 404 });
  try {
    const body = await req.json();
    const category = await prisma.category.update({ where: { id: current.id }, data: { name: String(body.name ?? current.name).trim(), priority: Number(body.priority ?? current.priority) } });
    return NextResponse.json(category);
  } catch { return NextResponse.json({ error: "更新分类失败" }, { status: 400 }); }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  const current = await prisma.category.findFirst({ where: { id: params.id, merchantId: merchant.id }, include: { _count: { select: { products: true } } } });
  if (!current) return NextResponse.json({ error: "分类不存在" }, { status: 404 });
  if (current._count.products > 0) return NextResponse.json({ error: "请先处理该分类下的商品" }, { status: 400 });
  await prisma.category.delete({ where: { id: current.id } });
  return NextResponse.json({ success: true });
}
