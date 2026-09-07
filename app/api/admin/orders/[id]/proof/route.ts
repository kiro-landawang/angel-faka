import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = params;
    const order = await prisma.order.findUnique({ where: { id }, select: { orderNo: true } });
    if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });

    const setting = await prisma.systemSetting.findUnique({ where: { key: `payment_proof:${order.orderNo}` } });
    if (!setting) return NextResponse.json({ proof: null });

    try {
      const data = JSON.parse(setting.value);
      return NextResponse.json({ proof: data });
    } catch {
      return NextResponse.json({ proof: { proof: setting.value, submittedAt: null } });
    }
  } catch (error) {
    console.error("[AdminProof] fetch error:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}
