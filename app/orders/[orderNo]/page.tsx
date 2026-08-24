"use client"

import { useState, useEffect } from "react"
import { Copy, Loader2, Check } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { StoreFooter } from "@/components/store-footer"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import React from "react"

interface Order {
  id: string
  orderNo: string
  email: string | null
  totalAmount: any
  status: string
  quantity: number
  paidAt: any
  product: {
    name: string
    deliveryFormat: string
  }
  licenses: {
    id: string
    code: string
  }[]
  createdAt: any
}

function CopyableField({ label, value }: { label: string, value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className="h-11 rounded-xl border-none bg-[#F6F6F4] font-mono text-sm shadow-none"
        />
        <Button variant="secondary" size="icon" className="h-11 w-11 shrink-0 rounded-xl" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function LicenseItem({ code, index, format }: { code: string, index: number, format: string }) {
  const [fullCopied, setFullCopied] = useState(false);

  const handleCopyFull = () => {
    navigator.clipboard.writeText(code);
    setFullCopied(true);
    setTimeout(() => setFullCopied(false), 2000);
  };

  if (format === "SINGLE" || !format) {
    return (
      <div className="rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">卡密 {index + 1}</span>
          <button type="button" className="rounded-full bg-[#F1EFE8] px-3 py-1 text-xs" onClick={handleCopyFull}>
            {fullCopied ? "已复制" : "复制"}
          </button>
        </div>
        <p className="break-all font-mono text-[15px] font-medium">{code}</p>
      </div>
    );
  }

  if (format.startsWith("ACCOUNT_")) {
    const parts = code.split("----");
    const labels = format === "ACCOUNT_FULL"
      ? ["账号", "密码", "辅助邮箱", "2FA 密钥"]
      : ["账号", "密码"];

    return (
      <div className="space-y-4 rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">账号信息 {index + 1}</span>
          <button type="button" className="rounded-full bg-[#F1EFE8] px-3 py-1 text-xs" onClick={handleCopyFull}>
            {fullCopied ? "已复制" : "复制全部"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {labels.map((label, i) => parts[i] && (
            <CopyableField key={label} label={label} value={parts[i]} />
          ))}
        </div>
      </div>
    );
  }

  if (format === "VIRTUAL_CARD") {
    const parts = code.split("|");
    const labels = ["卡号", "有效期 (月/年)", "CVV 安全码"];

    return (
      <div className="space-y-4 rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">虚拟卡 {index + 1}</span>
          <button type="button" className="rounded-full bg-[#F1EFE8] px-3 py-1 text-xs" onClick={handleCopyFull}>
            {fullCopied ? "已复制" : "复制全部"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {labels.map((label, i) => parts[i] && (
            <CopyableField key={label} label={label} value={parts[i]} />
          ))}
        </div>
      </div>
    );
  }

  if (format === "PROXY_IP") {
    const parts = code.split(":");
    const labels = ["主机 (Host)", "端口 (Port)", "用户 (User)", "密码 (Pass)"];

    return (
      <div className="space-y-4 rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">代理信息 {index + 1}</span>
          <button type="button" className="rounded-full bg-[#F1EFE8] px-3 py-1 text-xs" onClick={handleCopyFull}>
            {fullCopied ? "已复制" : "复制全部"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {labels.map((label, i) => parts[i] && (
            <CopyableField key={label} label={label} value={parts[i]} />
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default function OrderPage({ params }: { params: { orderNo: string } }) {
  const { orderNo } = params
  const searchParams = useSearchParams()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [checking, setChecking] = useState(false)

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${orderNo}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const tradeStatus = searchParams.get("trade_status")

    const syncPayment = async () => {
      if (tradeStatus === "TRADE_SUCCESS") {
        setSyncing(true)
        try {
          const query = searchParams.toString()
          await fetch(`/api/payments/epay/notify?${query}`)
        } catch (e) {
          console.error("Sync failed", e)
        } finally {
          setSyncing(false)
          fetchOrder()
        }
      } else {
        fetchOrder()
      }
    }

    syncPayment()
  }, [orderNo, searchParams])

  const handleCheckPayment = async () => {
    setChecking(true)
    try {
      const res = await fetch(`/api/orders/${orderNo}/check`, { method: "POST" })
      const data = await res.json()
      if (data.status === "PAID") {
        fetchOrder()
      } else {
        alert("未查询到支付成功记录，请稍后再试或联系客服。")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setChecking(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="px-5 py-20 text-center">
          <h1 className="text-2xl font-medium tracking-tight">订单不存在</h1>
        </div>
      </div>
    )
  }

  const isExpired = order.status === "EXPIRED" || (order.status === "PENDING" && new Date(order.createdAt).getTime() + 30 * 60 * 1000 < Date.now());
  const statusText = order.status === "PAID" ? "已支付" : isExpired ? "已过期" : "待支付"
  const statusClass = order.status === "PAID" ? "text-[#3B6D11]" : isExpired ? "text-muted-foreground" : "text-[#854F0B]"

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        {syncing && (
          <div className="mb-5 flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在同步支付状态
          </div>
        )}

        <p className={`text-xs ${statusClass}`}>{statusText}</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">{order.product.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">订单 {order.orderNo} · ¥{Number(order.totalAmount).toFixed(2)}</p>

        <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-2xl bg-white px-4 py-4">
            <p className="text-xs text-muted-foreground">数量</p>
            <p className="mt-1 font-medium">{order.quantity} 份</p>
          </div>
          <div className="rounded-2xl bg-white px-4 py-4">
            <p className="text-xs text-muted-foreground">联系方式</p>
            <p className="mt-1 font-medium">{order.email || "-"}</p>
          </div>
        </div>

        {order.status === "PAID" && (
          <div className="mt-6 space-y-3">
            {order.licenses.map((license, index) => (
              <LicenseItem
                key={license.id}
                code={license.code}
                index={index}
                format={order.product.deliveryFormat}
              />
            ))}
          </div>
        )}

        {order.status === "PENDING" && !isExpired && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-6 text-center">
            <p className="text-sm font-medium">付款完成后请不要关闭此页面</p>
            <p className="mt-2 text-xs text-muted-foreground">系统确认支付后会自动展示卡密。</p>
            <Button
              className="mt-5 h-11 w-full rounded-full"
              variant="secondary"
              onClick={handleCheckPayment}
              disabled={checking}
            >
              {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              我已支付，刷新状态
            </Button>
          </div>
        )}

        {isExpired && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-6 text-center text-sm text-muted-foreground">
            订单超时未支付，已自动关闭。请返回首页重新下单。
          </div>
        )}
      </div>
      <StoreFooter />
    </div>
  );
}
