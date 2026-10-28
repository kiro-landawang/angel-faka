"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, Lock, Loader2, Gift, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Navbar } from "@/components/navbar"
import { StoreFooter } from "@/components/store-footer"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<"login" | "register">("login")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email.trim() || !password) {
      setError("请输入邮箱和密码")
      return
    }
    if (password.length < 6) {
      setError("密码至少 6 位")
      return
    }
    setLoading(true)
    try {
      const url = mode === "login" ? "/api/customer/login" : "/api/customer/register"
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        router.push(mode === "register" ? "/login?redirectedFrom=lottery" : "/lottery")
        router.refresh()
      } else {
        setError(data.error || (mode === "login" ? "登录失败" : "注册失败"))
      }
    } catch {
      setError("网络错误，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Gift className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ANGEL 会员中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            登录后即可参与抽奖、用积分兑换卡密
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_16px_48px_rgba(15,23,42,0.10)]">
          <Tabs value={mode} onValueChange={(v) => { setMode(v as any); setError("") }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs text-muted-foreground">邮箱</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-11 rounded-xl border-border bg-muted/50 pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs text-muted-foreground">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="h-11 rounded-xl border-border bg-muted/50 pl-9"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                size="lg"
                className="h-12 w-full rounded-xl bg-primary text-base text-primary-foreground shadow-[0_10px_30px_rgba(59,130,246,0.30)] transition-all duration-150 hover:opacity-90"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? "登录" : "注册并登录"}
              </Button>
            </form>
          </Tabs>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            买卡送抽奖次数 · 抽积分 · 积分再换卡密
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          返回 <Link href="/" className="text-primary underline-offset-2 hover:underline">商城首页</Link>
        </p>
      </div>
      <StoreFooter />
    </main>
  )
}
