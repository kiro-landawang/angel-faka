import { NextResponse } from "next/server";
import { getCustomerId } from "@/lib/customer-auth";
import { ensureLotterySchema } from "@/lib/db-migrate";
import { checkRateLimit } from "@/lib/rate-limit";
import { getLotteryConfig, rollLottery, newId } from "@/lib/lottery";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "LotteryDraw" });

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function POST(req: Request) {
  const clientIp = getClientIP(req);
  if (!(await checkRateLimit("lottery_draw:ip:" + clientIp, 30, 5 * 60)).allowed) {
    return NextResponse.json({ error: "抽奖过于频繁，请稍后再试" }, { status: 429 });
  }

  await ensureLotterySchema();
  const customerId = await getCustomerId();
  if (!customerId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const cfg = await getLotteryConfig();
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new Error("customer not found");
      if (customer.drawsAvailable <= 0) {
        return { noDraws: true };
      }

      // 原子扣减抽奖次数
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: { drawsAvailable: { decrement: 1 } },
      });

      const draw = rollLottery(cfg);
      const newPoints = updated.points + draw.points;

      // 原子增加积分
      await tx.customer.update({
        where: { id: customerId },
        data: { points: { increment: draw.points } },
      });

      // 抽奖记录
      await tx.lotteryDraw.create({
        data: {
          id: newId(),
          customerId,
          resultType: draw.resultType,
          pointsAwarded: draw.points,
        },
      });

      // 积分流水
      await tx.pointLedger.create({
        data: {
          id: newId(),
          customerId,
          type: draw.resultType === "egg" ? "earn_egg" : "earn_draw",
          amount: draw.points,
          balanceAfter: newPoints,
          ref: null,
        },
      });

      return {
        noDraws: false,
        resultType: draw.resultType,
        points: draw.points,
        pointsBalance: newPoints,
        drawsAvailable: updated.drawsAvailable,
      };
    });

    if ((result as any).noDraws) {
      return NextResponse.json({ error: "没有可用的抽奖次数了" }, { status: 400 });
    }

    log.info({ customerId }, "Lottery draw done");
    return NextResponse.json(result);
  } catch (error: any) {
    log.error({ err: error?.message || "unknown" }, "Lottery draw error");
    return NextResponse.json({ error: "抽奖失败，请稍后重试" }, { status: 500 });
  }
}
