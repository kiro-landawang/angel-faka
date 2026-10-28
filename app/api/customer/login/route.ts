import { NextResponse } from "next/server";
import { customerLogin } from "@/lib/customer-auth";
import { ensureLotterySchema } from "@/lib/db-migrate";
import { checkRateLimit } from "@/lib/rate-limit";
import { captchaErrorMessage, verifyCaptcha } from "@/lib/captcha";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "CustomerLogin" });

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function POST(req: Request) {
  const clientIp = getClientIP(req);
  // 登录限流：每 IP 10 分钟内最多 10 次，抗密码爆破
  if (!(await checkRateLimit("customer_login:ip:" + clientIp, 10, 10 * 60)).allowed) {
    return NextResponse.json({ error: "尝试次数过多，请 10 分钟后再试" }, { status: 429 });
  }

  try {
    const { email, password, captchaToken, captchaAnswer } = await req.json();

    // 人机验证：必须在验密码之前拦下，否则爆破者拿不到验证码也照样能猜密码
    const captcha = await verifyCaptcha(captchaToken, captchaAnswer);
    if (!captcha.ok) {
      log.warn({ clientIp, reason: captcha.reason }, "Customer login captcha failed");
      return NextResponse.json(
        { error: captchaErrorMessage(captcha.reason), code: "CAPTCHA_FAILED" },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
    }

    await ensureLotterySchema();
    const ok = await customerLogin(String(email), String(password));
    if (!ok) {
      // 统一返回，不区分「账户不存在」与「密码错误」，防用户枚举
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }
    log.info({ clientIp }, "Customer login ok");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    log.error({ err: error?.message || "unknown" }, "Customer login error");
    return NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
}
