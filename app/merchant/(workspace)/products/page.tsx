"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plus, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  isActive: boolean;
  allowResale: boolean;
  sourceProductId?: string | null;
  sourcePrice?: string | number | null;
  resalePrice?: string | number | null;
  resaleMinPrice?: string | number | null;
  category?: { name: string } | null;
  _count: { licenses: number };
  sourceProduct?: { _count: { licenses: number } } | null;
};

type Form = { name: string; description: string; price: string; categoryId: string; allowResale: boolean; resalePrice: string; resaleMinPrice: string };
const emptyForm: Form = { name: "", description: "", price: "", categoryId: "", allowResale: false, resalePrice: "", resaleMinPrice: "" };

export default function MerchantProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [productsResponse, categoriesResponse] = await Promise.all([fetch("/api/merchant/products"), fetch("/api/merchant/categories")]);
    const productsData = await productsResponse.json();
    const categoriesData = await categoriesResponse.json();
    if (productsResponse.ok) setProducts(productsData.products || []); else setError(productsData.error || "商品加载失败");
    if (categoriesResponse.ok) setCategories(categoriesData.categories || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function update(key: keyof Form, value: string | boolean) { setForm((current) => ({ ...current, [key]: value })); }

  async function create(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/merchant/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, categoryId: form.categoryId || null }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setError(data.error || "创建商品失败");
    setForm(emptyForm); setMessage("商品已创建，可以去库存管理导入卡密"); await load();
  }

  async function updateProduct(product: Product, patch: Record<string, unknown>) {
    setError("");
    const response = await fetch(`/api/merchant/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "更新商品失败");
    setMessage("商品设置已保存"); await load();
  }

  async function remove(product: Product) {
    if (!window.confirm(`确定删除“${product.name}”？`)) return;
    const response = await fetch(`/api/merchant/products/${product.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "删除失败");
    await load();
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-primary">商户工作台</p><h1 className="text-3xl font-bold tracking-tight">商品管理</h1><p className="text-sm text-muted-foreground">创建商品、配置售价和分销规则，再到库存管理导入卡密。</p></div><div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground"><Store className="mr-2 inline h-4 w-4" />当前商户商品隔离管理</div></div>
    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    {message && <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500"><CheckCircle2 className="h-4 w-4" />{message}</div>}
    <Card className="border-primary/20 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" />创建商品</CardTitle></CardHeader><CardContent><form onSubmit={create} className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><label className="text-sm font-medium">商品名称</label><Input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="例如：Netflix 会员" required /></div><div className="space-y-2"><label className="text-sm font-medium">商品价格（元）</label><Input type="number" min="0" step="0.01" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="10.00" required /></div><div className="space-y-2"><label className="text-sm font-medium">商品分类</label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">自动使用默认分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className="space-y-2"><label className="text-sm font-medium">分销设置</label><label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={form.allowResale} onChange={(event) => update("allowResale", event.target.checked)} />允许其他商户按 ID 对接</label></div>{form.allowResale && <><div className="space-y-2"><label className="text-sm font-medium">对接价</label><Input type="number" min="0" step="0.01" value={form.resalePrice} onChange={(event) => update("resalePrice", event.target.value)} placeholder="A 的结算价" /></div><div className="space-y-2"><label className="text-sm font-medium">对外控价</label><Input type="number" min="0" step="0.01" value={form.resaleMinPrice} onChange={(event) => update("resaleMinPrice", event.target.value)} placeholder="B 的最低售价" /></div></>}<div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">商品说明（可选）</label><Textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="填写购买须知、发货说明等" /></div><div className="md:col-span-2"><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? "创建中..." : "创建商品"}</Button></div></form></CardContent></Card>
    <Card><CardHeader><CardTitle>我的商品 <span className="text-sm font-normal text-muted-foreground">({products.length})</span></CardTitle></CardHeader><CardContent className="p-0"><div className="divide-y">{loading ? <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : products.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">还没有商品，使用上方表单创建第一个商品。</div> : products.map((product) => { const stock = product.sourceProduct?._count.licenses ?? product._count.licenses; return <div key={product.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{product.name}</p><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{product.category?.name || "未分类"}</span>{product.sourceProductId && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">代销商品</span>}</div><p className="mt-1 text-xs text-muted-foreground">库存 {stock} · 售价 ¥{Number(product.price).toFixed(2)}{product.allowResale ? ` · 对接价 ¥${Number(product.resalePrice ?? product.price).toFixed(2)} · 控价 ¥${Number(product.resaleMinPrice ?? product.price).toFixed(2)}` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => updateProduct(product, { isActive: !product.isActive })}>{product.isActive ? "下架" : "上架"}</Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(product)} title="删除商品"><Trash2 className="h-4 w-4" /></Button></div></div>; })}</div></CardContent></Card>
  </div>;
}
