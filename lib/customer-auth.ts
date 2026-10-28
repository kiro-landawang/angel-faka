import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { SignJWT, jwtVerify } from "jose";
import { verifyPassword, hashPassword } from "@/lib/password";

const COOKIE_NAME = process.env.COOKIE_NAME_CUSTOMER || "angel_faka_customer_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 天
const log = logger.child({ module: "CustomerAuth" });

function deviceFingerprint(ua: string): string {
  return createHash("sha256")
    .update(`${process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || "no-secret"}:${ua}`, "utf8")
    .digest("hex")
    .slice(0, 24);
}

async function currentFingerprint(): Promise<string> {
  const h = headers();
  return deviceFingerprint(h.get("user-agent") || "unknown");
}

// 复用后台 JWT 密钥：登录态与后台隔离（role 不同），但共享同一签名密钥即可保证
// 生产环境必须有 JWT_SECRET / ADMIN_PASSWORD，否则抛错（防止默认密钥伪造会话）。
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD;
  if (secret) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV !== "production") {
    return new TextEncoder().encode("dev-only-insecure-secret-change-me");
  }
  throw new Error("FATAL: JWT_SECRET or ADMIN_PASSWORD must be set in production");
}

const JWT_SECRET = getJwtSecret();

function getCookieOptions() {
  const isSecure = process.env.NODE_ENV === "production" || process.env.ENABLE_SECURE_COOKIE === "true";
  return {
    httpOnly: true,
    secure: isSecure,
    maxAge: SESSION_DURATION,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function registerCustomer(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "邮箱格式不正确" };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: "密码至少 6 位" };
  }
  const existing = await prisma.customer.findUnique({ where: { email: normalized } });
  if (existing) {
    return { ok: false, error: "该邮箱已注册，请直接登录" };
  }
  const hashed = await hashPassword(password);
  await prisma.customer.create({ data: { email: normalized, password: hashed } });
  log.info({ email: normalized }, "Customer registered");
  return { ok: true };
}

export async function customerLogin(email: string, password: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const customer = await prisma.customer.findUnique({ where: { email: normalized } });
  // 账户不存在也走一次哈希比对，避免通过响应时间区分注册与否（抗用户枚举）
  const fake = await hashPassword("dummy-password-for-timing");
  const ok = customer ? await verifyPassword(password, customer.password) : await verifyPassword(password, fake);

  if (!customer || !ok) {
    log.warn({ email: normalized }, "Customer login failed");
    return false;
  }

  const fp = await currentFingerprint();
  const token = await new SignJWT({ role: "customer", sub: customer.id, fp })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(JWT_SECRET);

  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, getCookieOptions());
  log.info({ email: normalized }, "Customer login successful");
  return true;
}

export async function customerLogout() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCustomerId(): Promise<string | null> {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get(COOKIE_NAME);
    if (!session?.value) return null;

    const { payload } = await jwtVerify(session.value, JWT_SECRET, { clockTolerance: "1m" });
    if (payload.role !== "customer" || !payload.sub) return null;

    // 会话绑定设备指纹：cookie 被盗用 / 异机重放直接失效
    const fp = await currentFingerprint();
    if (payload.fp !== fp) {
      log.warn("Customer session fingerprint mismatch");
      return null;
    }
    return payload.sub as string;
  } catch {
    return null;
  }
}

export async function getCustomer() {
  const id = await getCustomerId();
  if (!id) return null;
  return prisma.customer.findUnique({ where: { id } });
}
