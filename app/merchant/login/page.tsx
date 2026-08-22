"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Mode = "login" | "register";
type RegisterForm = { username: string; password: string; name: string; slug: string };

const emptyRegisterForm: RegisterForm = { username: "", password: "", name: "", slug: "" };

export default function MerchantLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registerForm, setRegisterForm] = useState<RegisterForm>(emptyRegisterForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    setError("");
    if (nextMode === "register") {
      setRegisterForm((current) => ({ ...current, username: username || current.username }));
    }
  }

  function updateRegister(key: keyof RegisterForm, value: string) {
    setRegisterForm((current) => ({ ...current, [key]: value }));
  }

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/merchant/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "登录失败");
        return;
      }
      router.push("/merchant");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/merchant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerForm),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "注册失败");
        return;
      }
      setUsername(registerForm.username);
      setPassword("");
      setMode("login");
      setRegisterForm(emptyRegisterForm);
      setMessage("注册成功，商户后台已开通，请输入密码登录。");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLogin ? "商户登录" : "注册商户"}</CardTitle>
          <CardDescription>
            {isLogin ? "管理你的商品、库存、订单和优惠码。" : "注册后立即获得独立商户后台，数据与其他商户隔离。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLogin ? (
            <form onSubmit={submitLogin} className="space-y-4">
              <Input placeholder="登录账号" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
              <Input type="password" placeholder="密码" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-emerald-600">{message}</p>}
              <Button className="w-full" disabled={loading || !username || !password}>{loading ? "登录中..." : "登录商户后台"}</Button>
              <p className="text-center text-sm text-muted-foreground">
                没有账号？ <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => switchMode("register")}>立即注册</button>
              </p>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="space-y-4">
              <Input placeholder="登录账号（3-32 位）" value={registerForm.username} onChange={(event) => updateRegister("username", event.target.value)} autoComplete="username" required />
              <Input placeholder="店铺名称" value={registerForm.name} onChange={(event) => updateRegister("name", event.target.value)} required />
              <Input placeholder="店铺标识，例如 angel-shop" value={registerForm.slug} onChange={(event) => updateRegister("slug", event.target.value)} required />
              <Input type="password" placeholder="密码（至少 8 位）" value={registerForm.password} onChange={(event) => updateRegister("password", event.target.value)} autoComplete="new-password" required />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" disabled={loading}>{loading ? "创建商户中..." : "创建商户并返回登录"}</Button>
              <p className="text-center text-sm text-muted-foreground">
                已有账号？ <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => switchMode("login")}>返回登录</button>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
