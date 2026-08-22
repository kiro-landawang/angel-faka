"use client";

import { useEffect, useState } from "react";
import { Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Category { id: string; name: string; slug: string; priority: number; _count?: { products: number } }

export default function MerchantCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(""); const [priority, setPriority] = useState("0"); const [loading, setLoading] = useState(true); const [message, setMessage] = useState("");
  async function load() { setLoading(true); const res = await fetch("/api/merchant/categories"); const data = await res.json(); if (res.ok) setCategories(data.categories || []); else setMessage(data.error || "加载失败"); setLoading(false); }
  useEffect(() => { load(); }, []);
  async function create() { setMessage(""); if (!name.trim()) return setMessage("请填写分类名称"); const res = await fetch("/api/merchant/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, priority }) }); const data = await res.json(); if (!res.ok) return setMessage(data.error || "创建失败"); setName(""); setPriority("0"); setMessage("分类已创建"); load(); }
  async function edit(category: Category) { const next = window.prompt("分类名称", category.name); if (!next || next.trim() === category.name) return; const res = await fetch(`/api/merchant/categories/${category.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: next }) }); const data = await res.json(); if (!res.ok) return setMessage(data.error || "更新失败"); load(); }
  async function remove(category: Category) { if (!window.confirm(`删除分类“${category.name}”？`)) return; const res = await fetch(`/api/merchant/categories/${category.id}`, { method: "DELETE" }); const data = await res.json(); if (!res.ok) return setMessage(data.error || "删除失败"); load(); }
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">分类管理</h1><p className="text-sm text-muted-foreground">只管理当前商户自己的分类。</p></div><Card><CardHeader><CardTitle className="text-base">新增分类</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3"><Input className="max-w-xs" placeholder="分类名称" value={name} onChange={(e) => setName(e.target.value)} /><Input className="w-28" type="number" placeholder="排序" value={priority} onChange={(e) => setPriority(e.target.value)} /><Button onClick={create}><Plus className="mr-2 h-4 w-4" />新增</Button></CardContent></Card>{message && <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">{message}</p>}<Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left"><tr><th className="p-4">名称</th><th className="p-4">标识</th><th className="p-4">商品数</th><th className="p-4 text-right">操作</th></tr></thead><tbody>{loading ? <tr><td className="p-8 text-center" colSpan={4}><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : categories.length === 0 ? <tr><td className="p-8 text-center text-muted-foreground" colSpan={4}>暂无分类</td></tr> : categories.map((category) => <tr className="border-b last:border-0" key={category.id}><td className="p-4 font-medium">{category.name}</td><td className="p-4 font-mono text-xs text-muted-foreground">{category.slug}</td><td className="p-4">{category._count?.products ?? 0}</td><td className="p-4 text-right"><Button variant="ghost" size="icon" onClick={() => edit(category)}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(category)}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div></CardContent></Card></div>;
}
