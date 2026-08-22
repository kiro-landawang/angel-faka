"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SourceProduct = {
  id: string;
  name: string;
  price: string | number;
  merchant: { id: string; name: string; slug: string };
  category: { name: string };
  resalePrice?: string | number | null;
  resaleMinPrice?: string | number | null;
  _count: { licenses: number };
};

export default function ResaleMarketPage() {
  const [merchantId, setMerchantId] = useState("");
  const [products, setProducts] = useState<SourceProduct[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function searchSource(event?: React.FormEvent) {
    event?.preventDefault();
    if (!merchantId.trim()) return setMessage("请输入货源商户 ID");
    setLoading(true); setMessage("");
    const response = await fetch(`/api/merchant/resale-market?merchantId=${encodeURIComponent(merchantId.trim())}`);
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(data.error || "查询失败");
    setProducts(data.products || []);
    if (!data.products?.length) setMessage("该商户暂无开放对接的有库存商品");
  }

  async function connect(product: SourceProduct) {
    setMessage("");
    const salePrice = prices[product.id] || String(product.resaleMinPrice ?? product.resalePrice ?? product.price);
    const response = await fetch(`/api/merchant/resale-market/${product.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ salePrice, sourceMerchantId: product.merchant.id }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "对接失败");
    setProducts((current) => current.filter((item) => item.id !== product.id));
    setMessage(`${product.name} 已成功对接并上架到你的店铺`);
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">商户工作台</p><h1 className="text-3xl font-bold tracking-tight">货源对接</h1><p className="text-sm text-muted-foreground">输入货源商户 ID，只查看该商户主动开放的商品。</p></div><Link href="/merchant" className="text-sm underline">返回商户后台</Link></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-4 w-4" />查找货源商户</CardTitle></CardHeader><CardContent><form className="flex flex-col gap-2 sm:flex-row" onSubmit={searchSource}><Input value={merchantId} onChange={(event) => setMerchantId(event.target.value)} placeholder="输入商户 ID，例如 cm..." /><Button type="submit" disabled={loading}>{loading ? "查询中..." : <><Search className="mr-2 h-4 w-4" />查询商品</>}</Button></form></CardContent></Card>
    {message && <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">{message}</p>}
    <div className="grid gap-4 md:grid-cols-2">{products.map((product) => { const basePrice = Number(product.resalePrice ?? product.price); const minPrice = Number(product.resaleMinPrice ?? basePrice); return <Card key={product.id}><CardHeader><CardTitle>{product.name}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>货源商：{product.merchant.name}（{product.merchant.id}）</p><p>库存：{product._count.licenses}</p><p>对接价：¥{basePrice.toFixed(2)} · 对外控价：¥{minPrice.toFixed(2)}</p><div className="flex gap-2"><Input type="number" min={minPrice} step="0.01" value={prices[product.id] ?? String(minPrice)} onChange={(event) => setPrices({ ...prices, [product.id]: event.target.value })} aria-label={`${product.name}销售价`} /><Button onClick={() => connect(product)}>自主对接</Button></div></CardContent></Card>; })}</div>
  </div>;
}
