"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function MerchantRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "", name: "", slug: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    const response = await fetch("/api/merchant/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) return setMessage(data.error || "注册失败");
    setMessage("注册成功，商户后台已开通，正在进入工作台...");
    setTimeout(() => router.push("/merchant/login"), 800);
  }
  return <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>商户入驻</CardTitle><CardDescription>注册后立即进入你的独立商户后台，商品和订单与其他商户隔离。</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Input placeholder="登录账号" value={form.username} onChange={(e) => update("username", e.target.value)} /><Input placeholder="店铺名称" value={form.name} onChange={(e) => update("name", e.target.value)} /><Input placeholder="店铺标识，例如 angel-shop" value={form.slug} onChange={(e) => update("slug", e.target.value)} /><Input type="password" placeholder="密码，至少 8 位" value={form.password} onChange={(e) => update("password", e.target.value)} />{message && <p className="text-sm text-muted-foreground">{message}</p>}<Button className="w-full" disabled={loading}>{loading ? "创建商户中..." : "创建商户并进入后台"}</Button><p className="text-center text-sm text-muted-foreground"><Link className="underline" href="/merchant/login">返回商户登录</Link></p></form></CardContent></Card></div>;
}
