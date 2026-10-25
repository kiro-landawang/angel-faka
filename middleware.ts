import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 后台隐身中间件（第一道挡箭牌，签名级校验仍由各 API 的 isAuthenticated 负责）
 *
 * 背景：有攻击者批量扫描 /admin/* 与 /api/admin/* 做侦察（页面探测 / chunk 分析 /
 * 端点爆破）。本中间件在「没有会话 cookie」时直接返回 404：
 * - 扫描器无法确认后台是否存在（404 与不存在的路径不可区分）
 * - 未鉴权的管理 API 一律 404，不回 401（401 = 确认端点存在）
 *
 * 分层防御说明：本层只看 cookie 是否存在（不验签），伪造 cookie 的请求会
 * 继续走到页面 layout / API 的 isAuthenticated 做 JWT 真实校验后再被拒。
 * 登录/登出接口保持放行，否则管理员自己也无法登录。
 */
const COOKIE_NAME = process.env.COOKIE_NAME || "geekfaka_admin_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasSession) {
    return new NextResponse(null, { status: 404 });
  }

  if (
    pathname.startsWith("/api/admin") &&
    pathname !== "/api/admin/login" &&
    pathname !== "/api/admin/logout" &&
    !hasSession
  ) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/admin", "/api/admin/:path*"],
};
