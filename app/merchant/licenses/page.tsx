"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Product = { id: string; name: string; _count: { licenses: number } };
type License = { id: string; code: string; createdAt: string };

export default function MerchantLicensesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [codes, setCodes] = useState("");
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadProducts() {
    const response = await fetch("/api/merchant/products");
    const data = await response.json();
    if (response.ok) {
      setProducts(data.products || []);
      if (!productId && data.products?.[0]) setProductId(data.products[0].id);
    } else setMessage(data.error || "加载商品失败");
    setLoading(false);
  }
  async function loadLicenses(id = productId) {
    if (!id) return setLicenses([]);
    const response = await fetch(`/api/merchant/licenses?productId=${encodeURIComponent(id)}`);
    const data = await response.json();
    if (response.ok) setLicenses(data.licenses || []);
    else setMessage(data.error || "加载库存失败");
  }
  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { loadLicenses(); }, [productId]);

  async function importCodes() {
    const list = codes.split(/\r?\n/).map((code) => code.trim()).filter(Boolean);
    if (!productId) return setMessage("请先选择商品");
    if (!list.length) return setMessage("请粘贴至少一条卡密");
    setSaving(true); setMessage("");
    const response = await fetch("/api/merchant/licenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, codes: list }) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "导入失败");
    setCodes(""); setMessage(`已导入 ${data.count} 条卡密`); await loadProducts(); await loadLicenses();
  }

  const selected = products.find((product) => product.id === productId);
  return <div className="space-y-6">
    <div><p className="text-sm text-muted-foreground">商户工作台</p><h1 className="text-3xl font-bold tracking-tight">库存管理</h1><p className="text-sm text-muted-foreground">卡密只会写入当前商户自己的商品。</p></div>
    {message && <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">{message}</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" />导入卡密</CardTitle></CardHeader><CardContent className="space-y-4">
        <Select value={productId} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="选择商品" /></SelectTrigger><SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select>
        <Textarea value={codes} onChange={(event) => setCodes(event.target.value)} placeholder="每行一条卡密" className="min-h-48 font-mono text-xs" />
        <Button className="w-full" onClick={importCodes} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}导入库存</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2"><KeyRound className="h-4 w-4" />可用库存</span><span className="text-sm font-normal text-muted-foreground">{selected?.name || "未选择商品"} · {licenses.length} 条</span></CardTitle></CardHeader><CardContent className="max-h-[27rem] overflow-auto p-0"><div className="divide-y">{loading ? <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : licenses.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">暂无可用卡密</p> : licenses.map((license, index) => <div key={license.id} className="flex items-center gap-3 px-4 py-3 text-sm"><span className="w-8 text-xs text-muted-foreground">{index + 1}</span><code className="break-all font-mono">{license.code}</code></div>)}</div></CardContent></Card>
    </div>
  </div>;
}
