import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { AdminMobileNav } from "@/components/admin-mobile-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuth = await isAuthenticated();

  // 待支付订单数：侧边栏角标 + 顶栏通知红点共用
  let pendingCount = 0;
  if (isAuth) {
    try {
      pendingCount = await prisma.order.count({ where: { status: "PENDING" } });
    } catch {
      pendingCount = 0;
    }
  }

  return (
    // admin-shell：后台「极简白」主题作用域（globals.css），前台不受影响
    <div className="admin-shell flex h-screen flex-col bg-background text-foreground md:flex-row">
      <AdminSidebar pendingCount={pendingCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar pendingCount={pendingCount} />
        <AdminMobileNav pendingCount={pendingCount} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
