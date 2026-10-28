"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Gift, Coins, Loader2, History, Sparkles, Copy, Check, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { StoreFooter } from "@/components/store-footer"

interface Redeemable { id: string; name: string; redeemCost: number; stock: number }
interface HistoryItem { id: string; resultType: string; pointsAwarded: number; createdAt: string }

function resultLabel(t: string) {
  switch (t) {
    case "points_1": return "1 积分"
    case "points_2": return "2 积分"
    case "points_3": return "3 积分"
    case "egg": return "彩蛋"
    default: return t
  }
}

export default function LotteryPage() {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState("")
  const [points, setPoints] = useState(0)
  const [draws, setDraws] = useState(0)
  const [config, setConfig] = useState<any>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [redeemables, setRedeemables] = useState<Redeemable[]>([])

  const [drawing, setDrawing] = useState(false)
  const [lastResult, setLastResult] = useState<{ resultType: string; points: number } | null>(null)
  const [drawMsg, setDrawMsg] = useState("")

  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [redeemResult, setRedeemResult] = useState<{ code: string; productName: string; orderNo: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/lottery/me")
      if (res.status === 401) {
        setAuthed(false)
        return
      }
      if (res.ok) {
        const d = await res.json()
        setAuthed(true)
        setEmail(d.email)
        setPoints(d.points)
        setDraws(d.drawsAvailable)
        setConfig(d.config)
        setHistory(d.history || [])
        setRedeemables(d.redeemables || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDraw = async () => {
    if (drawing) return
    setDrawing(true)
    setLastResult(null)
    setDrawMsg("")
    try {
      const res = await fetch("/api/lottery/draw", { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDrawMsg(d.error || "抽奖失败")
        return
      }
      setLastResult({ resultType: d.resultType, points: d.points })
      setDraws(d.drawsAvailable)
      setPoints(d.pointsBalance)
      load()
    } catch {
      setDrawMsg("网络错误，请稍后重试")
    } finally {
      setDrawing(false)
    }
  }

  const handleRedeem = async (productId: string) => {
    setRedeemingId(productId)
    setRedeemResult(null)
    try {
      const res = await fetch("/api/points/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setRedeemResult({ code: d.code, productName: d.productName, orderNo: d.orderNo })
        setPoints(d.pointsBalance)
        load()
      } else {
        alert(d.error || "兑换失败")
      }
    } catch {
      alert("网络错误，请稍后重试")
    } finally {
      setRedeemingId(null)
    }
  }

  const copyCode = () => {
    if (!redeemResult) return
    navigator.clipboard.writeText(redeemResult.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </main>
    )
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Gift className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">需要先登录</h1>
          <p className="mt-2 text-sm text-gray-500">
            抽奖与积分兑换仅对注册用户开放。登录后即可用购买的卡密抽取抽奖次数。
          </p>
          <Link href="/login" className="mt-6">
            <Button size="lg" className="h-12 rounded-md bg-primary text-base text-primary-foreground hover:opacity-90">
              去登录 / 注册
            </Button>
          </Link>
        </div>
        <StoreFooter />
      </main>
    )
  }

  const weights = config
    ? `1积分 ${config.w1}% · 2积分 ${config.w2}% · 3积分 ${config.w3}% · 彩蛋 ${config.wEgg}%（${config.eggMin}-${config.eggMax}积分）`
    : ""

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-5 sm:py-10">
        {/* 顶部：标题 + 数据卡（手机竖排、桌面横排） */}
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">抽奖中心</h1>
            <p className="mt-1 truncate text-sm text-gray-500">{email}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0">
            <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-center">
              <p className="text-xs text-gray-500">我的积分</p>
              <p className="text-xl font-bold text-primary">{points}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-center">
              <p className="text-xs text-gray-500">剩余抽奖</p>
              <p className="text-xl font-bold text-gray-900">{draws}</p>
            </div>
          </div>
        </div>

        {/* 抽奖区 */}
        <div className="rounded-md border border-gray-200 bg-white p-5">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
            <div className="w-full text-center sm:w-auto sm:text-left">
              <h2 className="flex items-center justify-center gap-2 text-lg font-semibold sm:justify-start">
                <Sparkles className="h-5 w-5 text-primary" /> 幸运抽奖
              </h2>
              <p className="mt-1 text-xs text-gray-500">购买卡密赠送的抽奖次数，抽中积分可兑换卡密</p>
              {weights && <p className="mt-2 text-[11px] text-gray-400">{weights}</p>}
            </div>
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={handleDraw}
                disabled={drawing || draws <= 0}
                className="flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 text-primary transition-transform duration-200 active:scale-95 disabled:opacity-50 sm:h-32 sm:w-32"
              >
                {drawing ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <>
                    <Gift className="h-9 w-9" />
                    <span className="mt-1 text-sm font-bold">抽一次</span>
                  </>
                )}
              </button>
              <p className="mt-2 text-xs text-gray-500">剩余 {draws} 次</p>
            </div>
          </div>

          {drawMsg && <p className="mt-4 text-center text-sm text-destructive">{drawMsg}</p>}
          {lastResult && !drawMsg && (
            <div className="mt-4 rounded-md bg-primary/10 px-4 py-3 text-center text-sm text-primary">
              恭喜！抽中 <span className="font-bold">{resultLabel(lastResult.resultType)}</span>
              {lastResult.resultType === "egg" && `（${lastResult.points} 积分）`}
            </div>
          )}
        </div>

        {/* 积分兑换商城 */}
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Coins className="h-5 w-5 text-primary" /> 积分兑换
          </h2>
          {redeemResult ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-medium text-emerald-800">兑换成功：{redeemResult.productName}</p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 break-all rounded-md border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm text-gray-900">
                  {redeemResult.code}
                </code>
                <Button size="icon" className="h-11 w-11 shrink-0 rounded-md" onClick={copyCode}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <button
                type="button"
                className="mt-3 text-xs text-gray-500 underline-offset-2 hover:underline"
                onClick={() => setRedeemResult(null)}
              >
                继续兑换
              </button>
            </div>
          ) : redeemables.length === 0 ? (
            <div className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              暂无可兑换的卡密，敬请期待上架～
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {redeemables.map((r) => (
                <div key={r.id} className="rounded-md border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-gray-900">{r.name}</span>
                    <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {r.redeemCost} 积分
                    </span>
                  </div>
                  <Button
                    className="mt-3 h-10 w-full rounded-md bg-primary text-sm text-primary-foreground hover:opacity-90"
                    disabled={redeemingId === r.id || points < r.redeemCost}
                    onClick={() => handleRedeem(r.id)}
                  >
                    {redeemingId === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {points < r.redeemCost ? "积分不足" : "立即兑换"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 抽奖记录 */}
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <History className="h-5 w-5 text-primary" /> 抽奖记录
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">还没有抽奖记录，快去抽一次吧～</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex flex-col gap-1 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-gray-500 sm:text-sm">
                    {new Date(h.createdAt).toLocaleString("zh-CN", { hour12: false })}
                  </span>
                  <span className="font-medium text-primary">
                    {resultLabel(h.resultType)}{h.resultType === "egg" ? `（+${h.pointsAwarded}）` : `（+${h.pointsAwarded}积分）`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary">
            返回商城 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <StoreFooter />
    </main>
  )
}
