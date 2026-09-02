import { NextResponse } from "next/server";
import { login, logout } from "@/lib/auth";
import { checkAdminAccess } from "@/lib/admin-security";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function isRateLimited(username: string) {
  const now = Date.now();
  const current = attempts.get(username);
  if (!current || current.resetAt <= now) {
    attempts.set(username, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

function requestIdentity(req: Request, deviceId: unknown) {
  const netlifyIp = req.headers.get("x-nf-client-connection-ip")?.trim();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = netlifyIp || forwarded || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  return { ip, userAgent, deviceId: typeof deviceId === "string" ? deviceId.slice(0, 128) : undefined };
}

export async function POST(req: Request) {
  try {
    const { username, password, accessToken, deviceId } = await req.json();
    const normalizedUsername = String(username || "admin").trim();

    if (isRateLimited(normalizedUsername)) {
      return NextResponse.json({ error: "登录尝试过于频繁，请 15 分钟后再试" }, { status: 429 });
    }

    const access = await checkAdminAccess({
      token: accessToken,
      ...requestIdentity(req, deviceId),
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const success = await login(normalizedUsername, password);
    if (success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}

export async function DELETE() {
  await logout();
  return NextResponse.json({ success: true });
}
