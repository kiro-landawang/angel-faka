import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

const COOKIE_NAME = process.env.MERCHANT_COOKIE_NAME || "geekfaka_merchant_session";
const SESSION_DURATION = 60 * 60 * 24 * 14;
// 解析商户 JWT 签名密钥。
// 重要：生产环境必须显式配置 JWT_SECRET（或 ADMIN_PASSWORD），禁止回退到
// 任何可预测的默认值——否则攻击者可利用默认密钥伪造任意商户会话
// （role=merchant, merchantId=他人ID），登录他人商户后台窃取订单与卡密。
function getMerchantJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD;
  if (secret) return new TextEncoder().encode(secret);
  // 仅允许在开发/本地环境回退到一个非生产密钥，避免误部署到生产后被人利用。
  if (process.env.NODE_ENV !== "production") {
    return new TextEncoder().encode("dev-only-insecure-merchant-secret-change-me");
  }
  throw new Error("FATAL: JWT_SECRET or ADMIN_PASSWORD must be set in production");
}

const JWT_SECRET = getMerchantJwtSecret();

type MerchantSession = {
  id: string;
  username: string;
  name: string;
  slug: string;
  status: string;
};

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.ENABLE_SECURE_COOKIE === "true",
    maxAge: SESSION_DURATION,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function merchantLogin(username: string, password: string) {
  const merchant = await prisma.merchant.findUnique({ where: { username } });
  if (!merchant || !(await verifyPassword(password, merchant.password))) {
    return { ok: false as const, reason: "INVALID_CREDENTIALS" as const };
  }
  if (merchant.status !== "APPROVED") {
    return { ok: false as const, reason: merchant.status as "PENDING" | "REJECTED" | "SUSPENDED" };
  }

  const token = await new SignJWT({ role: "merchant", merchantId: merchant.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(JWT_SECRET);

  cookies().set(COOKIE_NAME, token, cookieOptions());
  return { ok: true as const, merchant: toSession(merchant) };
}

export async function getCurrentMerchant(): Promise<MerchantSession | null> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: "1m" });
    if (payload.role !== "merchant" || typeof payload.merchantId !== "string") return null;

    const merchant = await prisma.merchant.findUnique({ where: { id: payload.merchantId } });
    if (!merchant) return null;
    if (merchant.status !== "APPROVED") return null;
    return toSession(merchant);
  } catch {
    return null;
  }
}

export async function merchantLogout() {
  cookies().delete(COOKIE_NAME);
}

export async function registerMerchant(input: {
  username: string;
  password: string;
  name: string;
  slug: string;
}) {
  const passwordHash = await hashPassword(input.password);
  const merchant = await prisma.merchant.create({
    data: {
      username: input.username,
      password: passwordHash,
      name: input.name,
      slug: input.slug,
      status: "APPROVED",
    },
  });
  return toSession(merchant);
}

function toSession(merchant: {
  id: string;
  username: string;
  name: string;
  slug: string;
  status: string;
}): MerchantSession {
  return {
    id: merchant.id,
    username: merchant.username,
    name: merchant.name,
    slug: merchant.slug,
    status: merchant.status,
  };
}
