"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Loader2 } from "lucide-react"

function getDeviceId() {
  const key = "angel-faka-device-id"
  const current = window.localStorage.getItem(key)
  if (current) return current
  const value = crypto.randomUUID()
  window.localStorage.setItem(key, value)
  return value
}

export default function AdminLogin() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, accessToken, deviceId: getDeviceId() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        router.push("/admin")
        router.refresh()
      } else {
        setError(data.error || "登录失败")
        setLoading(false)
      }
    } catch {
      setError("网络错误，请稍后再试")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm bg-background/95 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">管理员登录</CardTitle>
          <CardDescription>请输入账号、密码和认证令牌</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-3">
            <Input type="text" placeholder="管理员账号" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            <Input type="password" placeholder="管理员密码" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <Input type="password" placeholder="认证令牌" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} autoComplete="one-time-code" />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled={!username || !password || !accessToken || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              登录
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
