import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 后台分层防护中间件（签名级校验仍由各 API 的 isAuthenticated 负责）
 *
 * 分层策略（2026-11-01 调整）：
 * - 页面层（/admin/**，无会话 cookie）：307 重定向到 /admin/login。
 *   早期这里是直接 404，本意是「让扫描器无法确认后台存在」。但 /admin/login
 *   本身就是公开的 200 页面，扫描器一定能发现后台，页面层 404 的隐身收益为零，
 *   副作用却是站长清空浏览器 cookie 后连自己的后台都进不去（会看到 404）。
 *   重定向发生在 middleware 层，请求不会进入页面渲染，不存在 RSC 数据泄露风险。
 * - API 层（/api/admin/**，无会话 cookie）：继续返回 404 而非 401。
 *   这里才是隐身真正有价值的地方：401 = 确认端点存在，404 = 与不存在的路径不可区分，
 *   可有效阻断批量端点爆破。
 *
 * 注意：本层只看 cookie 是否存在（不验签），伪造 cookie 的请求会继续走到页面
 * layout / API 的 isAuthenticated 做 JWT 真实校验后再被拒。
 * 登录/登出接口保持放行，否则管理员自己也无法登录。
 */
const COOKIE_NAME = process.env.COOKIE_NAME || "geekfaka_admin_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value);

  // 页面层：没会话就送去登录页，而不是甩一个 404 让人以为站点挂了
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  // API 层：保持 404 隐身，阻断未鉴权的端点探测
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
