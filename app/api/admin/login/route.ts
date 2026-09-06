import { NextResponse } from "next/server";
import { login, logout } from "@/lib/auth";
import { checkAdminAccess } from "@/lib/admin-security";
import { checkRateLimit } from "@/lib/rate-limit";

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

    if (!(await checkRateLimit("admin_login:user:" + normalizedUsername, 8, 15 * 60)).allowed || !(await checkRateLimit("admin_login:ip:" + ip, 20, 15 * 60)).allowed) {
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
