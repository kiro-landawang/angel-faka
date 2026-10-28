import { NextResponse } from "next/server";
import { getCustomer } from "@/lib/customer-auth";
import { ensureLotterySchema } from "@/lib/db-migrate";
import { getLotteryConfig } from "@/lib/lottery";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await ensureLotterySchema();
  const customer = await getCustomer();
  if (!customer) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const [history, redeemables, cfg] = await Promise.all([
    prisma.lotteryDraw.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.product.findMany({
      where: { isRedeemable: true, isActive: true },
      include: { _count: { select: { licenses: { where: { status: "AVAILABLE" } } } } },
      orderBy: { createdAt: "desc" },
    }),
    getLotteryConfig(),
  ]);

  return NextResponse.json({
    email: customer.email,
    points: customer.points,
    drawsAvailable: customer.drawsAvailable,
    config: cfg,
    history: history.map((h) => ({
      id: h.id,
      resultType: h.resultType,
      pointsAwarded: h.pointsAwarded,
      createdAt: h.createdAt,
    })),
    redeemables: redeemables
      .filter((p) => (p._count.licenses ?? 0) > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        redeemCost: p.redeemCost ?? 0,
        stock: p._count.licenses ?? 0,
      })),
  });
}
