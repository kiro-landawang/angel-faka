import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ensureLotterySchema } from "@/lib/db-migrate";
import { newId } from "@/lib/lottery";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "AdminCustomers" });

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

// 列出顾客账户（分页 + 邮箱搜索）
export async function GET(req: Request) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    await ensureLotterySchema();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const q = (searchParams.get("q") || "").trim();
    const skip = (page - 1) * limit;

    const where = q ? { email: { contains: q, mode: "insensitive" as const } } : {};

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          email: true,
          points: true,
          drawsAvailable: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { orders: true, lotteryDraws: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({
      customers,
      pagination: { total, pages: Math.ceil(total / limit), page, limit },
    });
  } catch (error: any) {
    log.error({ err: error?.message || "unknown" }, "Failed to list customers");
    return NextResponse.json({ error: "Failed to list customers" }, { status: 500 });
  }
}

// 管理员手动调整积分 / 抽奖次数（带审计流水）
export async function POST(req: Request) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  const clientIp = getClientIP(req);
  if (!(await checkRateLimit("admin_customer_adjust:ip:" + clientIp, 30, 5 * 60)).allowed) {
    return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  }

  try {
    await ensureLotterySchema();
    const body = await req.json();
    const { customerId, pointsDelta, drawsDelta, note } = body;

    if (!customerId) {
      return NextResponse.json({ error: "缺少顾客参数" }, { status: 400 });
    }
    const pd = Number(pointsDelta);
    const dd = Number(drawsDelta);
    if (!Number.isFinite(pd) || !Number.isFinite(dd)) {
      return NextResponse.json({ error: "积分/次数调整必须为数字" }, { status: 400 });
    }
    if (pd === 0 && dd === 0) {
      return NextResponse.json({ error: "请至少填写一项调整值" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) return { error: "顾客不存在", status: 404 };

      const newPoints = Math.max(0, customer.points + pd);
      const newDraws = Math.max(0, customer.drawsAvailable + dd);

      await tx.customer.update({
        where: { id: customerId },
        data: {
          points: newPoints,
          drawsAvailable: newDraws,
        },
      });

      // 审计流水：积分变动
      if (pd !== 0) {
        await tx.pointLedger.create({
          data: {
            id: newId(),
            customerId,
            type: "admin_adjust",
            amount: pd,
            balanceAfter: newPoints,
            ref: note ? String(note).slice(0, 200) : "管理员调整积分",
          },
        });
      }
      // 审计流水：抽奖次数变动（amount 记为 0，仅作审计记录）
      if (dd !== 0) {
        await tx.pointLedger.create({
          data: {
            id: newId(),
            customerId,
            type: "admin_adjust",
            amount: 0,
            balanceAfter: newPoints,
            ref: `抽奖次数调整 ${dd > 0 ? "+" : ""}${dd}${note ? " | " + String(note).slice(0, 180) : ""}`,
          },
        });
      }

      return { error: null, status: 200, newPoints, newDraws };
    });

    if ((result as any).error) {
      return NextResponse.json({ error: (result as any).error }, { status: (result as any).status || 400 });
    }

    log.info({ customerId, pointsDelta: pd, drawsDelta: dd }, "Admin adjusted customer");
    return NextResponse.json({ success: true, ...(result as any) });
  } catch (error: any) {
    log.error({ err: error?.message || "unknown" }, "Admin adjust customer error");
    return NextResponse.json({ error: "调整失败，请稍后重试" }, { status: 500 });
  }
}
