import { NextResponse } from "next/server";
import { login, logout } from "@/lib/auth";
import { checkAdminAccess } from "@/lib/admin-security";

const userAttempts = new Map<string, { count: number; resetAt: number }>();
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_USER_ATTEMPTS = 8;
const MAX_IP_ATTEMPTS = 20; // 分布式爆破防护：同一 IP 即便换用户名也会被限流

function hitLimit(map: Map<string, { count: number; resetAt: number }>, key: string, max: number) {
  const now = Date.now();
  const current = map.get(key);
  if (!current || current.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > max;
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
    const { ip, userAgent } = requestIdentity(req, deviceId);

    if (hitLimit(userAttempts, normalizedUsername, MAX_USER_ATTEMPTS) || hitLimit(ipAttempts, ip, MAX_IP_ATTEMPTS)) {
      console.warn(`[AUDIT] Admin login rate-limited: user=${normalizedUsername} ip=${ip} ua=${userAgent}`);
      return NextResponse.json({ error: "登录尝试过于频繁，请 15 分钟后再试" }, { status: 429 });
    }

    const access = await checkAdminAccess({
      token: accessToken,
      ...requestIdentity(req, deviceId),
    });
    if (!access.ok) {
      console.warn(`[AUDIT] Admin login access-token rejected: user=${normalizedUsername} ip=${ip} status=${access.status}`);
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const success = await login(normalizedUsername, password);
    if (success) {
      console.warn(`[AUDIT] Admin login SUCCESS: user=${normalizedUsername} ip=${ip} ua=${userAgent}`);
      return NextResponse.json({ success: true });
    }
    console.warn(`[AUDIT] Admin login FAILED (bad password): user=${normalizedUsername} ip=${ip} ua=${userAgent}`);
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}

export async function DELETE() {
  await logout();
  return NextResponse.json({ success: true });
}
