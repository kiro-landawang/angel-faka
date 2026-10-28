import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { ensureLotterySchema } from "@/lib/db-migrate";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "AdminCustomerDetail" });

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    await ensureLotterySchema();
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        points: true,
        drawsAvailable: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { orders: true, lotteryDraws: true } },
      },
    });
    if (!customer) {
      return NextResponse.json({ error: "顾客不存在" }, { status: 404 });
    }

    const [ledger, draws] = await Promise.all([
      prisma.pointLedger.findMany({
        where: { customerId: params.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.lotteryDraw.findMany({
        where: { customerId: params.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({ customer, ledger, draws });
  } catch (error: any) {
    log.error({ err: error?.message || "unknown" }, "Failed to load customer detail");
    return NextResponse.json({ error: "Failed to load customer" }, { status: 500 });
  }
}
