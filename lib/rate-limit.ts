import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// 全局(数据库级)速率限制，跨 Serverless 实例生效。
// key: 限流维度标识（如 "admin_login:ip:1.2.3.4"）；limit: 窗口内最大次数；windowSeconds: 窗口秒数。
// 故障兜底：数据库异常时「放行」，避免误伤正常请求（仅记录日志），但绝不因限流故障而阻断业务。
export async function checkRateLimit(
  key: string,
  limit = 10,
  windowSeconds = 300
): Promise<RateLimitResult> {
  const now = Date.now();
  const expiresAt = new Date(now + windowSeconds * 1000);
  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });
    if (!existing || existing.expiresAt.getTime() <= now) {
      // 桶不存在或已过期 → 重置为 1
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: 1, expiresAt },
      });
      return { allowed: true, remaining: limit - 1, resetAt: expiresAt };
    }
    const newCount = existing.count + 1;
    await prisma.rateLimit.update({ where: { key }, data: { count: newCount } });
    return {
      allowed: newCount <= limit,
      remaining: Math.max(0, limit - newCount),
      resetAt: existing.expiresAt,
    };
  } catch (err) {
    console.error("[rate-limit] check failed, allowing request:", (err as Error)?.message);
    return { allowed: true, remaining: 0, resetAt: expiresAt };
  }
}
