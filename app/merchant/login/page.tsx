"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function MerchantLoginPage() {
  const router = useRouter(); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); const response = await fetch("/api/merchant/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await response.json(); setLoading(false); if (!response.ok) return setMessage(data.error || "登录失败"); router.push("/merchant"); }
  return <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>商户登录</CardTitle><CardDescription>管理你的商品、库存、订单和优惠码。</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Input placeholder="登录账号" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /><Input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />{message && <p className="text-sm text-destructive">{message}</p>}<Button className="w-full" disabled={loading || !username || !password}>{loading ? "登录中..." : "登录"}</Button><p className="text-center text-sm text-muted-foreground"><Link className="underline" href="/merchant/register">申请商户入驻</Link></p></form></CardContent></Card></div>;
}
