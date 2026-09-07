import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function GET(
  req: Request,
  { params }: { params: { orderNo: string } }
) {
  try {
    const { orderNo } = params;
    const order = await prisma.order.findUnique({ where: { orderNo }, select: { status: true } });
    if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });

    const setting = await prisma.systemSetting.findUnique({ where: { key: `payment_proof:${orderNo}` } });
    if (!setting) return NextResponse.json({ proof: null });

    try {
      const data = JSON.parse(setting.value);
      return NextResponse.json({ proof: data });
    } catch {
      return NextResponse.json({ proof: { proof: setting.value, submittedAt: null } });
    }
  } catch (error) {
    console.error("[AppreciationProof] get error:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { orderNo: string } }
) {
  try {
    const clientIp = getClientIP(req);
    if (!(await checkRateLimit("order_proof:ip:" + clientIp, 10, 5 * 60)).allowed) {
      return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
    }

    const { orderNo } = params;
    const { proof } = await req.json();
    const proofText = typeof proof === "string" ? proof.trim() : "";

    if (!proofText || proofText.length < 2 || proofText.length > 200) {
      return NextResponse.json({ error: "请输入有效的付款凭证（2-200 字）" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    if (order.status === "PAID") return NextResponse.json({ error: "订单已支付" }, { status: 400 });
    if (order.status !== "PENDING") return NextResponse.json({ error: "订单状态不允许提交凭证" }, { status: 400 });

    const key = `payment_proof:${orderNo}`;
    const value = JSON.stringify({
      proof: proofText,
      submittedAt: new Date().toISOString(),
      amount: Number(order.totalAmount).toFixed(2),
    });

    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, description: "用户提交的赞赏码付款凭证" },
      update: { value },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AppreciationProof] submit error:", error);
    return NextResponse.json({ error: "提交失败" }, { status: 500 });
  }
}
