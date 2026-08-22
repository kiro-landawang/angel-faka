import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

const COOKIE_NAME = process.env.MERCHANT_COOKIE_NAME || "geekfaka_merchant_session";
const SESSION_DURATION = 60 * 60 * 24 * 14;
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || "default-secret-please-change"
);

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
    secure: process.env.ENABLE_SECURE_COOKIE === "true",
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
    if (!merchant || merchant.status !== "APPROVED") return null;
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
      status: "PENDING",
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
