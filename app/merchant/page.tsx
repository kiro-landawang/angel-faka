import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentMerchant } from "@/lib/merchant-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, Coins, Package, ShoppingBag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MerchantDashboardPage() {
  const merchant = await getCurrentMerchant();
  if (!merchant) return null;

  const orderScope = { OR: [{ merchantId: merchant.id }, { sourceMerchantId: merchant.id }, { resellerMerchantId: merchant.id }] };
  const [products, categories, availableLicenses, coupons, orders, revenue, recentProducts] = await Promise.all([
    prisma.product.count({ where: { merchantId: merchant.id } }),
    prisma.category.count({ where: { merchantId: merchant.id } }),
    prisma.license.count({ where: { merchantId: merchant.id, status: "AVAILABLE" } }),
    prisma.coupon.count({ where: { merchantId: merchant.id, isUsed: false } }),
    prisma.order.count({ where: orderScope }),
    prisma.order.aggregate({ where: { ...orderScope, status: "PAID" }, _sum: { totalAmount: true } }),
    prisma.product.findMany({
      where: { merchantId: merchant.id, isActive: true },
      select: { id: true, name: true, price: true, sourceProduct: { select: { _count: { select: { licenses: { where: { status: "AVAILABLE" } } } } } }, _count: { select: { licenses: { where: { status: "AVAILABLE" } } } } },
      orderBy: { updatedAt: "desc" }, take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div><p className="text-sm text-muted-foreground">商户工作台</p><h1 className="text-3xl font-bold tracking-tight">仪表盘</h1><p className="text-sm text-muted-foreground">只显示 {merchant.name} 的商品、库存和订单数据。</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat title="商品" value={products} icon={ShoppingBag} />
        <Stat title="分类" value={categories} icon={Package} />
        <Stat title="可用库存" value={availableLicenses} icon={Activity} />
        <Stat title="订单" value={orders} icon={ShoppingBag} />
        <Stat title="已支付流水" value={`¥${Number(revenue._sum.totalAmount || 0).toFixed(2)}`} icon={Coins} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>最近更新的商品</CardTitle></CardHeader><CardContent className="space-y-3">
          {recentProducts.length === 0 ? <p className="text-sm text-muted-foreground">还没有商品，先创建一个商品吧。</p> : recentProducts.map((product) => { const stock = product.sourceProduct?._count.licenses ?? product._count.licenses; return <div key={product.id} className="flex items-center justify-between border-b pb-3 last:border-0"><div><p className="font-medium">{product.name}</p><p className="text-xs text-muted-foreground">¥{Number(product.price).toFixed(2)}</p></div><span className={stock < 10 ? "flex items-center gap-1 text-sm text-yellow-500" : "text-sm text-muted-foreground"}>{stock < 10 && <AlertTriangle className="h-3.5 w-3.5" />}库存 {stock}</span></div>; })}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>快捷入口</CardTitle></CardHeader><CardContent className="grid gap-2"><Link href="/merchant/products" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">管理商品</Link><Link href="/merchant/licenses" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">导入库存</Link><Link href="/merchant/resale-market" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">进入代销市场</Link><Link href="/merchant/coupons" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">创建优惠码</Link><p className="pt-2 text-xs text-muted-foreground">未使用优惠码：{coupons}</p></CardContent></Card>
      </div>
    </div>
  );
}

function Stat({ title, value, icon: Icon }: { title: string; value: string | number; icon: typeof Activity }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>;
}
