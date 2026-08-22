import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, ShoppingBag, Package, KeyRound, FileText, Ticket, Store, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const merchant = await getCurrentMerchant();
  if (!merchant) redirect("/merchant/login");

  const links = [
    ["/merchant", "仪表盘", LayoutDashboard],
    ["/merchant/products", "商品管理", ShoppingBag],
    ["/merchant/categories", "分类管理", Package],
    ["/merchant/licenses", "库存管理", KeyRound],
    ["/merchant/orders", "订单列表", FileText],
    ["/merchant/coupons", "优惠码管理", Ticket],
    ["/merchant/resale-market", "代销市场", Store],
  ] as const;

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-background text-foreground dark md:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/70 md:flex">
        <div className="flex h-16 items-center border-b px-6"><div><p className="text-xs font-medium uppercase tracking-wider text-primary">GeekFaka</p><p className="text-lg font-bold">商户工作台</p></div></div>
        <div className="border-b px-6 py-3">
          <p className="truncate text-sm font-medium">{merchant.name}</p>
          <p className="truncate text-xs text-muted-foreground">ID：{merchant.id}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {links.map(([href, label, Icon]) => (
            <Link key={href} href={href}>
              <Button variant="ghost" className="w-full justify-start rounded-lg py-5 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                <Icon className="mr-2 h-4 w-4" />{label}
              </Button>
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t p-4">
          <Link href="/" className="block">
            <Button variant="outline" className="w-full"><Store className="mr-2 h-4 w-4" />返回商城</Button>
          </Link>
          <a href="/api/merchant/logout" className="block">
            <Button variant="ghost" className="w-full"><LogOut className="mr-2 h-4 w-4" />退出登录</Button>
          </a>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">{children}</main>
    </div>
  );
}
