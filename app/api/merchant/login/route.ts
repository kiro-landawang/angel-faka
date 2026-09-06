import { NextResponse } from "next/server";
import { merchantLogin } from "@/lib/merchant-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!(await checkRateLimit("merchant_login:ip:" + ip, 20, 15 * 60)).allowed || !(await checkRateLimit("merchant_login:user:" + username, 10, 15 * 60)).allowed) {
      return NextResponse.json({ error: "登录尝试过于频繁，请 15 分钟后再试" }, { status: 429 });
    }
    const result = await merchantLogin(username, password);

    if (result.ok) return NextResponse.json({ success: true, merchant: result.merchant });
    if (result.reason === "PENDING") return NextResponse.json({ error: "账号暂不可用，请联系平台管理员" }, { status: 403 });
    if (result.reason === "REJECTED") return NextResponse.json({ error: "账号已被平台停用" }, { status: 403 });
    if (result.reason === "SUSPENDED") return NextResponse.json({ error: "账号已被暂停" }, { status: 403 });
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
