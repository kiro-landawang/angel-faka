import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MerchantActions } from "@/components/admin/merchant-actions";

export const dynamic = "force-dynamic";

export default async function MerchantsPage() {
  if (!await isAuthenticated()) redirect("/admin/login");
  const merchants = await prisma.merchant.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, username: true, name: true, slug: true, status: true, createdAt: true, _count: { select: { products: true, orders: true } } } });
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">商户管理</h1><p className="text-sm text-muted-foreground">审核入驻申请并控制商户状态。</p></div><div className="overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">店铺</th><th className="p-3">账号</th><th className="p-3">状态</th><th className="p-3">商品</th><th className="p-3">订单</th><th className="p-3">操作</th></tr></thead><tbody>{merchants.map((merchant) => <tr key={merchant.id} className="border-b last:border-0"><td className="p-3">{merchant.name}<div className="text-xs text-muted-foreground">{merchant.slug}</div></td><td className="p-3">{merchant.username}</td><td className="p-3">{merchant.status}</td><td className="p-3">{merchant._count.products}</td><td className="p-3">{merchant._count.orders}</td><td className="p-3"><MerchantActions id={merchant.id} status={merchant.status} /></td></tr>)}</tbody></table></div></div>;
}
