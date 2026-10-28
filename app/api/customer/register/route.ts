import { NextResponse } from "next/server";
import { registerCustomer } from "@/lib/customer-auth";
import { ensureLotterySchema } from "@/lib/db-migrate";
import { checkRateLimit } from "@/lib/rate-limit";
import { captchaErrorMessage, verifyCaptcha } from "@/lib/captcha";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "CustomerRegister" });

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function POST(req: Request) {
  const clientIp = getClientIP(req);
  // 注册限流：每 IP 10 分钟内最多 5 次，防止批量注册 / 薅羊毛
  if (!(await checkRateLimit("customer_register:ip:" + clientIp, 5, 10 * 60)).allowed) {
    return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  }

  try {
    const { email, password, captchaToken, captchaAnswer } = await req.json();

    // 人机验证：挡在注册逻辑之前，防止脚本批量注册薅抽奖次数
    const captcha = await verifyCaptcha(captchaToken, captchaAnswer);
    if (!captcha.ok) {
      log.warn({ clientIp, reason: captcha.reason }, "Customer register captcha failed");
      return NextResponse.json(
        { error: captchaErrorMessage(captcha.reason), code: "CAPTCHA_FAILED" },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
    }

    await ensureLotterySchema();
    const result = await registerCustomer(String(email), String(password));
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "注册失败" }, { status: 400 });
    }
    log.info({ clientIp }, "Customer registered");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    log.error({ err: error?.message || "unknown" }, "Customer register error");
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
