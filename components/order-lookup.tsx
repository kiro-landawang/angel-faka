"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import Link from "next/link"

export function OrderLookup() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setHasSearched(false)
    setResults([])

    try {
      const res = await fetch(`/api/orders/query?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      setHasSearched(true)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const statusLabel = (status: string) => {
    if (status === "PAID") return { text: "已支付", className: "bg-[#EAF3DE] text-[#3B6D11]" }
    if (status === "PENDING") return { text: "待支付", className: "bg-[#FAEEDA] text-[#854F0B]" }
    if (status === "EXPIRED") return { text: "已过期", className: "bg-secondary text-muted-foreground" }
    return { text: status, className: "bg-secondary text-muted-foreground" }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          订单
        </button>
      </DialogTrigger>
      <DialogContent className="border-none bg-[#F6F6F4] p-0 sm:max-w-lg sm:rounded-3xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-medium tracking-tight">查找订单</DialogTitle>
          <DialogDescription>输入邮箱、手机号或订单号</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2 px-6">
          <Input
            placeholder="联系方式 / 订单号"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 rounded-xl border-none bg-white shadow-none"
          />
          <Button type="submit" disabled={loading} className="h-11 rounded-xl px-5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "查询"}
          </Button>
        </form>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto px-6 pb-6">
          {hasSearched && results.length === 0 && (
            <div className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-muted-foreground">
              未找到相关订单
            </div>
          )}

          {results.map((order) => {
            const badge = statusLabel(order.status)
            return (
              <Link
                key={order.orderNo}
                href={`/orders/${order.orderNo}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-2xl bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{order.product.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(order.createdAt)} · ¥{Number(order.totalAmount).toFixed(2)}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${badge.className}`}>{badge.text}</span>
              </Link>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
