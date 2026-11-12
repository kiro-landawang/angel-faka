import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard, ShoppingBag, Package, Activity, TrendingUp, AlertTriangle, ChevronRight } from "lucide-react";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Helper to calculate percentage change
const calculateChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

function OrderStatusBadge({ status }: { status: string }) {
  if (status === "PAID") return <Badge className="bg-emerald-600 hover:bg-emerald-600">已支付</Badge>;
  if (status === "PENDING") return <Badge className="bg-amber-500 hover:bg-amber-500">待支付</Badge>;
  if (status === "EXPIRED") return <Badge variant="secondary">已过期</Badge>;
  return <Badge variant="destructive">失败</Badge>;
}

/** 统计卡：图标统一中性色，涨跌用语义色小标签（方案 A 的克制配色） */
function StatCard({
  label,
  value,
  icon: Icon,
  foot,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  foot: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-5 pt-4">
        <CardTitle className="text-[13px] font-medium text-muted-foreground">{label}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground/70">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">{foot}</div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    redirect("/admin/login");
  }

  // Timezone Adjustment for China (UTC+8)
  const now = new Date();
  const utcOffset = 8;
  const chinaTime = new Date(now.getTime() + utcOffset * 3600000);

  const todayStartChina = new Date(chinaTime.getFullYear(), chinaTime.getMonth(), chinaTime.getDate());
  const todayStart = new Date(todayStartChina.getTime() - utcOffset * 3600000);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  // 1. Fetch Orders for Today and Yesterday
  const todayOrders = await prisma.order.findMany({
    where: { status: "PAID", paidAt: { gte: todayStart } },
    select: { totalAmount: true }
  });

  const yesterdayOrders = await prisma.order.findMany({
    where: { status: "PAID", paidAt: { gte: yesterdayStart, lt: todayStart } },
    select: { totalAmount: true }
  });

  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const todayOrderCount = todayOrders.length;
  const yesterdayOrderCount = yesterdayOrders.length;

  const revenueChange = calculateChange(todayRevenue, yesterdayRevenue);
  const orderChange = calculateChange(todayOrderCount, yesterdayOrderCount);

  // 2. Fetch Last 7 Days Trend
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const recentOrders = await prisma.order.findMany({
    where: { status: "PAID", paidAt: { gte: sevenDaysAgo } },
    select: { paidAt: true, totalAmount: true }
  });

  // Group by date
  const trendMap = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' });
    trendMap.set(key, 0);
  }

  recentOrders.forEach(order => {
    if (order.paidAt) {
      const key = order.paidAt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' });
      if (trendMap.has(key)) {
        trendMap.set(key, (trendMap.get(key) || 0) + Number(order.totalAmount));
      }
    }
  });

  const trendData = Array.from(trendMap.entries()).map(([date, amount]) => ({ date, amount }));

  // 3. Overall Stats
  const productCount = await prisma.product.count();
  const totalRevenueAllTimeRaw = await prisma.order.aggregate({
    where: { status: "PAID" },
    _sum: { totalAmount: true }
  });
  const totalRevenueAllTime = Number(totalRevenueAllTimeRaw._sum.totalAmount || 0);
  const paidCountAllTime = await prisma.order.count({ where: { status: "PAID" } });

  // 4. Low Stock Products (< 10)
  const productsWithStock = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      price: true,
      _count: {
        select: { licenses: { where: { status: "AVAILABLE" } } }
      }
    }
  });

  const lowStockProducts = productsWithStock
    .map(p => ({ ...p, stock: p._count.licenses }))
    .filter(p => p.stock < 10)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  // 5. Latest orders (最新订单表)
  const latestOrders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      orderNo: true,
      email: true,
      totalAmount: true,
      status: true,
      quantity: true,
      createdAt: true,
      product: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">仪表盘</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">经营数据一览</p>
      </div>

      {/* Top Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="今日收入"
          value={`¥${todayRevenue.toFixed(2)}`}
          icon={CreditCard}
          foot={
            <>
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${revenueChange >= 0 ? "bg-emerald-600/10 text-emerald-600" : "bg-red-600/10 text-red-600"}`}>
                {revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(1)}%
              </span>
              较昨日 ¥{yesterdayRevenue.toFixed(2)}
            </>
          }
        />
        <StatCard
          label="今日订单"
          value={String(todayOrderCount)}
          icon={ShoppingBag}
          foot={
            <>
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${orderChange >= 0 ? "bg-emerald-600/10 text-emerald-600" : "bg-red-600/10 text-red-600"}`}>
                {orderChange >= 0 ? "+" : ""}{orderChange.toFixed(1)}%
              </span>
              较昨日 {yesterdayOrderCount} 单
            </>
          }
        />
        <StatCard
          label="累计收入"
          value={`¥${totalRevenueAllTime.toFixed(2)}`}
          icon={Activity}
          foot={<>历史总流水 · {paidCountAllTime.toLocaleString()} 单</>}
        />
        <StatCard
          label="在售商品"
          value={String(productCount)}
          icon={Package}
          foot={
            lowStockProducts.length > 0 ? (
              <span className="text-amber-600">{lowStockProducts.length} 件缺货预警</span>
            ) : (
              "库存充足"
            )
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {/* Revenue Trend Chart */}
        <Card className="md:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-foreground/60" />
                近 7 日收入趋势
              </CardTitle>
              <CardDescription className="mt-1 text-xs">单位：元</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <RevenueChart data={trendData} />
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className="md:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                缺货预警
              </CardTitle>
              <CardDescription className="mt-1 text-xs">库存少于 10 件的商品</CardDescription>
            </div>
            <Link href="/admin/products" className="flex items-center text-xs text-muted-foreground hover:text-foreground">
              补货 <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="divide-y">
              {lowStockProducts.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  库存充足，暂无预警
                </div>
              ) : (
                lowStockProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">单价: ¥{Number(p.price).toFixed(2)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${p.stock === 0 ? "bg-red-600/10 text-red-600" : "bg-amber-500/10 text-amber-600"}`}>
                      {p.stock === 0 ? "已售罄" : `剩 ${p.stock} 件`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">最新订单</CardTitle>
            <CardDescription className="mt-1 text-xs">最近 6 笔，按下单时间倒序</CardDescription>
          </div>
          <Link href="/admin/orders" className="flex items-center text-xs text-muted-foreground hover:text-foreground">
            查看全部 <ChevronRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>订单号</TableHead>
              <TableHead>商品</TableHead>
              <TableHead>联系邮箱</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {latestOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  暂无订单
                </TableCell>
              </TableRow>
            ) : (
              latestOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{o.orderNo}</TableCell>
                  <TableCell className="text-[13px]">
                    {o.product.name}
                    {o.quantity > 1 && <span className="ml-1 text-xs text-muted-foreground">× {o.quantity}</span>}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-[13px] text-muted-foreground">{o.email || "—"}</TableCell>
                  <TableCell className="text-[13px] font-semibold">¥{Number(o.totalAmount).toFixed(2)}</TableCell>
                  <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.createdAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
