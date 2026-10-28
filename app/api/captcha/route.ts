import { NextResponse } from "next/server";
import { createCaptcha } from "@/lib/captcha";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function GET(req: Request) {
  const clientIp = getClientIP(req);
  // 防止有人狂刷取图接口：每 IP 5 分钟最多 40 张
  if (!(await checkRateLimit("captcha_issue:ip:" + clientIp, 40, 5 * 60)).allowed) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  const { token, image } = createCaptcha();
  return NextResponse.json(
    { token, image },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
