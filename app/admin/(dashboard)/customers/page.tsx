"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Search, Coins, Ticket, FileText, ArrowLeft, Plus, Minus, Save, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Customer {
  id: string
  email: string
  points: number
  drawsAvailable: number
  createdAt: string
  updatedAt: string
  _count: { orders: number; lotteryDraws: number }
}

interface LedgerRow {
  id: string
  type: string
  amount: number
  balanceAfter: number
  ref: string | null
  createdAt: string
}

interface DrawRow {
  id: string
  resultType: string
  pointsAwarded: number
  createdAt: string
}

const TYPE_LABEL: Record<string, string> = {
  earn_draw: "抽奖获得",
  earn_egg: "彩蛋获得",
  redeem: "积分兑换",
  admin_adjust: "管理员调整",
}

const RESULT_LABEL: Record<string, string> = {
  points_1: "1 积分",
  points_2: "2 积分",
  points_3: "3 积分",
  egg: "彩蛋",
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [q, setQ] = useState("")
  const [searchInput, setSearchInput] = useState("")

  const [detail, setDetail] = useState<Customer | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [draws, setDraws] = useState<DrawRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const [pointsDelta, setPointsDelta] = useState("")
  const [drawsDelta, setDrawsDelta] = useState("")
  const [note, setNote] = useState("")
  const [adjusting, setAdjusting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (q) params.set("q", q)
      const res = await fetch(`/api/admin/customers?${params.toString()}`)
      if (!res.ok) throw new Error("load failed")
      const data = await res.json()
      setCustomers(data.customers || [])
      setTotalPages(data.pagination?.pages || 1)
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [page, q])

  useEffect(() => {
    load()
  }, [load])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setQ(searchInput.trim())
  }

  const openDetail = async (c: Customer) => {
    setDetail(c)
    setIsDetailOpen(true)
    setDetailLoading(true)
    setPointsDelta("")
    setDrawsDelta("")
    setNote("")
    try {
      const res = await fetch(`/api/admin/customers/${c.id}`)
      if (!res.ok) throw new Error("detail failed")
      const data = await res.json()
      setLedger(data.ledger || [])
      setDraws(data.draws || [])
    } catch {
      setLedger([])
      setDraws([])
    } finally {
      setDetailLoading(false)
    }
  }

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detail) return
    const pd = Number(pointsDelta) || 0
    const dd = Number(drawsDelta) || 0
    if (pd === 0 && dd === 0) {
      alert("请至少填写一项调整值")
      return
    }
    if (!confirm(`确认对 ${detail.email} 进行调整？\n积分 ${pd > 0 ? "+" : ""}${pd}，抽奖次数 ${dd > 0 ? "+" : ""}${dd}`)) return
    setAdjusting(true)
    try {
      const res = await fetch(`/api/admin/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: detail.id, pointsDelta: pd, drawsDelta: dd, note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "调整失败")
      alert("调整成功")
      // 刷新列表与详情
      await load()
      if (detail) {
        const refreshed = await fetch(`/api/admin/customers/${detail.id}`)
        if (refreshed.ok) {
          const d = await refreshed.json()
          setDetail(d.customer)
          setLedger(d.ledger || [])
          setDraws(d.draws || [])
        }
      }
      setPointsDelta("")
      setDrawsDelta("")
      setNote("")
    } catch (err: any) {
      alert(err?.message || "调整失败")
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">用户 / 积分管理</h1>
          <p className="text-sm text-muted-foreground">
            查看注册顾客、积分与抽奖次数，可手动调整（带审计流水）。
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索邮箱"
              className="pl-8 w-56"
            />
          </div>
          <Button type="submit" variant="secondary">搜索</Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>邮箱</TableHead>
              <TableHead className="text-right">积分</TableHead>
              <TableHead className="text-right">抽奖次数</TableHead>
              <TableHead className="text-right">订单数</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  暂无顾客数据
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">{c.email}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      <Coins className="h-3.5 w-3.5" /> {c.points}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                      <Ticket className="h-3.5 w-3.5" /> {c.drawsAvailable}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{c._count.orders}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openDetail(c)}>
                      查看 / 调整
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2">
        <div className="flex-1 text-sm text-muted-foreground">
          第 {page} / {totalPages} 页
        </div>
        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>
          <ArrowLeft className="h-4 w-4" /> 上一页
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>
          下一页
        </Button>
      </div>

      {/* Detail dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>顾客详情</span>
              {detail && <Badge variant="secondary" className="font-normal">{detail.email}</Badge>}
            </DialogTitle>
            <DialogDescription>
              {detail && (
                <span>
                  当前积分 <b className="text-primary">{detail.points}</b> · 抽奖次数 <b className="text-amber-500">{detail.drawsAvailable}</b> · 订单 {detail._count.orders}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* 调整表单 */}
              <form onSubmit={submitAdjust} className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                <p className="text-sm font-medium text-primary">手动调整</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">积分调整（可正可负）</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        value={pointsDelta}
                        onChange={(e) => setPointsDelta(e.target.value)}
                        placeholder="例如 +10 或 -5"
                        className="pl-7"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        {pointsDelta.startsWith("-") ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">抽奖次数调整（可正可负）</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        value={drawsDelta}
                        onChange={(e) => setDrawsDelta(e.target.value)}
                        placeholder="例如 +3"
                        className="pl-7"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        {drawsDelta.startsWith("-") ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">备注（可选，记入审计流水）</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：活动补偿" maxLength={200} />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={adjusting} size="sm">
                    {adjusting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                    提交调整
                  </Button>
                </div>
              </form>

              {/* 抽奖记录 */}
              <div>
                <p className="mb-2 text-sm font-medium flex items-center gap-1">
                  <RefreshCw className="h-3.5 w-3.5" /> 最近抽奖记录
                </p>
                {draws.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无抽奖记录</p>
                ) : (
                  <div className="space-y-1">
                    {draws.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded border border-border/60 bg-muted/30 px-2 py-1 text-xs">
                        <span>{RESULT_LABEL[d.resultType] || d.resultType}</span>
                        <span className="font-semibold text-primary">+{d.pointsAwarded}</span>
                        <span className="text-muted-foreground">{new Date(d.createdAt).toLocaleString("zh-CN")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 积分流水 */}
              <div>
                <p className="mb-2 text-sm font-medium flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> 积分 / 抽奖审计流水
                </p>
                {ledger.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无流水</p>
                ) : (
                  <div className="space-y-1">
                    {ledger.map((l) => (
                      <div key={l.id} className="flex items-center justify-between rounded border border-border/60 bg-muted/30 px-2 py-1 text-xs">
                        <span className="w-24 shrink-0">{TYPE_LABEL[l.type] || l.type}</span>
                        <span className={cn("w-16 text-right font-semibold", l.amount > 0 ? "text-green-500" : l.amount < 0 ? "text-destructive" : "text-muted-foreground")}>
                          {l.amount > 0 ? `+${l.amount}` : l.amount}
                        </span>
                        <span className="w-20 text-right text-muted-foreground">余 {l.balanceAfter}</span>
                        <span className="flex-1 truncate pl-2 text-muted-foreground" title={l.ref || ""}>
                          {l.ref || ""}
                        </span>
                        <span className="w-32 shrink-0 text-right text-muted-foreground">
                          {new Date(l.createdAt).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
