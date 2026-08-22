"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Order = { id: string; orderNo: string; email?: string | null; totalAmount: string | number; status: string; quantity: number; paymentMethod?: string | null; createdAt: string; product: { name: string }; sourceProduct?: { name: string } | null; sourceMerchantId?: string | null; resellerMerchantId?: string | null; resellerProfit?: string | number | null };

function statusBadge(status: string) {
  if (status === "PAID") return <Badge className="bg-green-600">已支付</Badge>;
  if (status === "PENDING") return <Badge variant="outline" className="border-yellow-500 text-yellow-500">待支付</Badge>;
  return <Badge variant="destructive">{status}</Badge>;
}

export default function MerchantOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]); const [search, setSearch] = useState(""); const [loading, setLoading] = useState(true); const [message, setMessage] = useState("");
  async function load() { setLoading(true); const response = await fetch("/api/merchant/orders"); const data = await response.json(); if (response.ok) setOrders(data.orders || []); else setMessage(data.error || "加载订单失败"); setLoading(false); }
  useEffect(() => { load(); }, []);
  const filtered = orders.filter((order) => !search || `${order.orderNo} ${order.email || ""} ${order.product.name}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">商户工作台</p><h1 className="text-3xl font-bold tracking-tight">订单管理</h1><p className="text-sm text-muted-foreground">包含自营订单、你的代销订单，以及由你供货的订单。</p></div><form className="flex gap-2" onSubmit={(event) => event.preventDefault()}><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索订单号、邮箱或商品" /><Button type="submit" variant="secondary" size="icon" title="搜索"><Search className="h-4 w-4" /></Button></form></div>
    {message && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{message}</p>}
    <div className="rounded-md border bg-card"><Table><TableHeader><TableRow><TableHead>订单号</TableHead><TableHead>商品</TableHead><TableHead>金额</TableHead><TableHead>关系</TableHead><TableHead>状态</TableHead><TableHead>时间</TableHead><TableHead className="text-right">详情</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">暂无订单</TableCell></TableRow> : filtered.map((order) => <TableRow key={order.id}><TableCell><p className="font-mono text-xs font-semibold">{order.orderNo}</p><p className="text-xs text-muted-foreground">{order.email || "未填写邮箱"}</p></TableCell><TableCell><p className="max-w-48 truncate font-medium">{order.product.name}</p><p className="text-xs text-muted-foreground">x{order.quantity}{order.sourceProduct ? ` · 货源：${order.sourceProduct.name}` : ""}</p></TableCell><TableCell className="font-semibold">¥{Number(order.totalAmount).toFixed(2)}{order.resellerProfit ? <p className="text-xs text-green-500">利润 ¥{Number(order.resellerProfit).toFixed(2)}</p> : null}</TableCell><TableCell className="text-xs text-muted-foreground">{order.resellerMerchantId ? "代销订单" : order.sourceMerchantId ? "供货订单" : "自营订单"}</TableCell><TableCell>{statusBadge(order.status)}</TableCell><TableCell className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" title="查看前台详情" onClick={() => window.open(`/orders/${order.orderNo}`, "_blank")}><ExternalLink className="h-4 w-4" /></Button></TableCell></TableRow>)}</TableBody></Table></div>
  </div>;
}
