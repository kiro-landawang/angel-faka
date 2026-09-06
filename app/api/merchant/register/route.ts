import { NextResponse } from "next/server";
import { registerMerchant } from "@/lib/merchant-auth";

function validSlug(value: string) {
  return /^[a-z0-9-]{3,32}$/.test(value);
}

const rateLimitMap = new Map<string, number[]>();
function isRateLimited(ip: string, limit = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return recent.length > limit;
}
function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIP(req);
    if (isRateLimited(clientIp)) {
      return NextResponse.json({ error: "注册过于频繁，请稍后再试" }, { status: 429 });
    }
    const body = await req.json();
    const username = String(body.username || "").trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return NextResponse.json({ error: "账号只能使用字母、数字、下划线或短横线" }, { status: 400 });
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const slug = String(body.slug || "").trim().toLowerCase();

    if (username.length < 3 || username.length > 32 || password.length < 8 || name.length < 2 || !validSlug(slug)) {
      return NextResponse.json({ error: "账号、店铺名称或店铺标识格式不正确" }, { status: 400 });
    }

    const merchant = await registerMerchant({ username, password, name, slug });
    return NextResponse.json({ success: true, status: "APPROVED", merchant, redirect: "/merchant/login" });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "账号或店铺标识已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
