"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Product = {
  id: string;
  name: string;
  price: string | number;
  isActive: boolean;
  allowResale: boolean;
  sourceProductId?: string | null;
  sourcePrice?: string | number | null;
  resalePrice?: string | number | null;
  resaleMinPrice?: string | number | null;
  _count: { licenses: number };
  sourceProduct?: { _count: { licenses: number } } | null;
};

export default function MerchantProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/merchant/products");
    const data = await response.json();
    if (response.ok) setProducts(data.products || []);
    else setMessage(data.error || "加载失败");
  }

  useEffect(() => { load(); }, []);

  async function update(product: Product, patch: Record<string, unknown>) {
    const response = await fetch(`/api/merchant/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "更新失败");
    setMessage("商品已更新");
    await load();
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">商户后台</p><h1 className="text-3xl font-bold">我的商品</h1></div>
          <div className="flex gap-3"><Link className="text-sm underline" href="/merchant/resale-market">代销市场</Link><Link className="text-sm underline" href="/merchant">返回后台</Link></div>
        </div>
        {message && <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">{message}</p>}
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="flex flex-wrap items-center gap-3 rounded-md border p-4">
              <div className="min-w-[220px] flex-1"><p className="font-medium">{product.name}</p><p className="text-xs text-muted-foreground">库存 {product.sourceProduct?._count.licenses ?? product._count.licenses} · ¥{Number(product.price).toFixed(2)}{product.sourceProductId ? ` · 货源价 ¥${Number(product.sourcePrice || 0).toFixed(2)}` : ""}</p></div>
              {product.sourceProductId ? <Input className="w-32" type="number" min={Number(product.sourcePrice || 0)} step="0.01" defaultValue={String(product.price)} onBlur={(event) => update(product, { price: event.target.value })} /> : <div className="flex flex-wrap items-center gap-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={product.allowResale} onChange={(event) => update(product, { allowResale: event.target.checked })} />允许分销</label>{product.allowResale && <><Input className="w-28" type="number" min="0" step="0.01" placeholder="对接价" defaultValue={product.resalePrice == null ? "" : String(product.resalePrice)} onBlur={(event) => update(product, { resalePrice: event.target.value })} /><Input className="w-28" type="number" min="0" step="0.01" placeholder="对外控价" defaultValue={product.resaleMinPrice == null ? "" : String(product.resaleMinPrice)} onBlur={(event) => update(product, { resaleMinPrice: event.target.value })} /></>}</div>}
              <Button variant="outline" onClick={() => update(product, { isActive: !product.isActive })}>{product.isActive ? "下架" : "上架"}</Button>
            </div>
          ))}
          {products.length === 0 && <p className="text-muted-foreground">暂无商品。</p>}
        </div>
      </div>
    </main>
  );
}
