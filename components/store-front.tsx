"use client"

import { useState, useEffect, useMemo, useCallback, memo } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, Minus, Plus, Check, X } from "lucide-react"
import { Mascot } from "@/components/mascot"
import { SidebarNav } from "@/components/sidebar-nav"
import { cn } from "@/lib/utils"

// Lazy-load the heavy markdown renderer so it stays out of the initial bundle
// and is only parsed on demand (when a described product's dialog opens).
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false })

// ---- visual helpers (deterministic, no external image assets needed) ----
const PRODUCT_EMOJIS = ["🎮", "🎬", "🎵", "💻", "📺", "🎁", "⚡", "🌟", "💎", "🎯", "🚀", "🔥"]
const PRODUCT_GRADIENTS = [
  "linear-gradient(135deg,#ffc2dc,#ff8fb4)",
  "linear-gradient(135deg,#ffd0e6,#f59ac0)",
  "linear-gradient(135deg,#ffc2da,#e8659a)",
  "linear-gradient(135deg,#fcd2e8,#d273a6)",
  "linear-gradient(135deg,#ffc4dd,#ff8fb8)",
  "linear-gradient(135deg,#f3c8e6,#c270cf)",
]
function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function productVisual(seed: string) {
  const h = hashStr(seed)
  return {
    emoji: PRODUCT_EMOJIS[h % PRODUCT_EMOJIS.length],
    gradient: PRODUCT_GRADIENTS[h % PRODUCT_GRADIENTS.length],
  }
}
const CATEGORY_EMOJI: Record<string, string> = {
  游戏: "🎮",
  影视: "🎬",
  音乐: "🎵",
  软件: "💻",
  会员: "⭐",
  账号: "👤",
  代充: "💰",
  课程: "📚",
  其他: "🌸",
}
function categoryEmoji(name: string) {
  for (const k of Object.keys(CATEGORY_EMOJI)) if (name.includes(k)) return CATEGORY_EMOJI[k]
  return "🌸"
}

// 库存概况分级（阈值自定）：售空 ≤0、少 <10、多 <50、很多 ≥50
function stockTier(stock: number) {
  if (stock <= 0) return { label: "售空", badge: "bg-zinc-900/55 text-white", sub: "暂时缺货" }
  if (stock < 10) return { label: "少", badge: "bg-[#E2725B]/85 text-white", sub: "库存紧张 · 自动发货" }
  if (stock < 50) return { label: "多", badge: "bg-white/85 text-zinc-600", sub: "现货充足 · 自动发货" }
  return { label: "很多", badge: "bg-emerald-500/80 text-white", sub: "现货极充足 · 自动发货" }
}

interface Product {
  id: string
  name: string
  description: string | null
  price: string
  stock: number
  image?: string | null
}

interface Category {
  id: string
  name: string
  products: Product[]
}

interface PaymentChannel {
  id: string
  name: string
  icon: string
  provider: string
  fee?: number
}

const ProductCard = memo(function ProductCard({
  product,
  onBuy,
}: {
  product: Product
  onBuy: (p: Product) => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const v = productVisual(product.id)
  const soldOut = product.stock <= 0
  const tier = stockTier(product.stock)
  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onBuy(product)}
      className={cn(
        // 白底液态玻璃：半透明 + 背景折射 + 圆角小块
        "group relative flex flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/75 text-left shadow-[0_8px_30px_rgba(22,22,40,0.07)]",
        // 微交互：鼠标一放轻轻浮起、边框染赤陶、投影变暖
        "transition-[transform,box-shadow,border-color] duration-300 ease-out will-change-transform",
        "hover:-translate-y-2 hover:border-[#E2725B]/45 hover:shadow-[0_22px_60px_rgba(226,114,91,0.22)]",
        soldOut && "opacity-60"
      )}
    >
      <div className="relative h-40 sm:h-44" style={{ background: v.gradient }}>
        {product.image && !imageFailed ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-4xl drop-shadow-sm" aria-hidden>
            {v.emoji}
          </span>
        )}
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-medium",
            tier.badge
          )}
        >
          {tier.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-[15px] font-semibold text-zinc-900">{product.name}</p>
        <p className="mt-1 text-xs text-zinc-400">
          {tier.sub}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-semibold text-[#E2725B]">¥{Number(product.price).toFixed(2)}</span>
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-[box-shadow,transform] duration-200",
              soldOut
                ? "bg-zinc-200 text-zinc-400"
                : "bg-gradient-to-br from-[#E2725B] to-[#C2553C] text-white group-hover:shadow-[0_6px_16px_rgba(226,114,91,0.45)] group-hover:-translate-y-0.5"
            )}
          >
            {soldOut ? "售罄" : "购买"}
          </span>
        </div>
      </div>
    </button>
  )
})

export function StoreFront({
  categories,
  featured = false,
}: {
  categories: Category[]
  featured?: boolean
}) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isBuyOpen, setIsBuyOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<PaymentChannel[]>([])
  const [paymentMethod, setPaymentMethod] = useState("")
  const [email, setEmail] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [emailError, setEmailError] = useState("")
  const [couponCode, setCouponCode] = useState("")
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discountType: "FIXED" | "PERCENTAGE"
    discountValue: number
  } | null>(null)
  const [couponError, setCouponError] = useState("")
  const [paymentError, setPaymentError] = useState("")

  const currentCategory = useMemo(
    () => categories.find((category) => category.id === activeCategory) ?? categories[0],
    [categories, activeCategory]
  )
  const shelfProducts = currentCategory?.products ?? []
  const selectedChannel = channels.find((channel) => channel.id === paymentMethod)
  const subtotal = selectedProduct ? Number(selectedProduct.price) * quantity : 0
  let discount = 0
  if (appliedCoupon) {
    discount =
      appliedCoupon.discountType === "PERCENTAGE"
        ? subtotal * (appliedCoupon.discountValue / 100)
        : appliedCoupon.discountValue
  }
  const productTotal = Math.max(0, subtotal - discount)
  const feePercent = selectedChannel?.fee || 0
  const feeAmount = productTotal * (feePercent / 100)
  const finalTotal = productTotal + feeAmount

  useEffect(() => {
    fetch("/api/config/payments")
      .then((res) => res.json())
      .then((data) => {
        setChannels(data)
        if (data.length > 0) setPaymentMethod(data[0].id)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!isBuyOpen) {
      setEmailError("")
      setCouponCode("")
      setAppliedCoupon(null)
      setCouponError("")
      setPaymentError("")
    }
  }, [isBuyOpen])

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setIsValidatingCoupon(true)
    setCouponError("")

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, productId: selectedProduct?.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setAppliedCoupon({
          code: data.code,
          discountType: data.discountType,
          discountValue: Number(data.discountValue),
        })
      } else {
        setCouponError(data.error || "无效的优惠码")
        setAppliedCoupon(null)
      }
    } catch {
      setCouponError("验证失败")
    } finally {
      setIsValidatingCoupon(false)
    }
  }

  const handleBuyClick = useCallback((product: Product) => {
    if (product.stock <= 0) return
    setSelectedProduct(product)
    setQuantity(1)
    setIsBuyOpen(true)
  }, [])

  const handlePurchase = async () => {
    if (!selectedProduct) return
    if (!validateEmail(email)) {
      setEmailError("请输入有效的邮箱地址，用于接收订单通知")
      return
    }
    if (!paymentMethod) {
      alert("请选择支付方式")
      return
    }

    setEmailError("")
    setPaymentError("")
    setLoading(true)

    try {
      const selected = channels.find((channel) => channel.id === paymentMethod)
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity,
          email,
          paymentMethod: selected?.provider || "dummy",
          couponCode: appliedCoupon?.code,
          options: { channel: paymentMethod },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPaymentError(data.error || "下单失败，请稍后重试")
        return
      }
      if (data.payUrl) window.location.href = data.payUrl
    } catch (error) {
      console.error(error)
      setPaymentError("网络错误，请检查连接后重试")
    } finally {
      setLoading(false)
    }
  }

  if (categories.length === 0) {
    return (
      <div className="py-24 text-center text-zinc-400">
        <p className="text-2xl font-semibold tracking-tight text-zinc-900">暂无商品上架</p>
        <p className="mt-2 text-sm">商品准备好后会显示在这里</p>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <Mascot />

      <div className="relative z-10">
        {featured && (
          // 极简信任条：白底玻璃、大留白
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["⚡", "秒级自动发货"],
              ["🔒", "信息加密保护"],
              ["💬", "7×24 售后"],
            ].map(([icon, label]) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-4 py-3.5 shadow-[0_8px_30px_rgba(22,22,40,0.06)]"
              >
                <span className="text-xl" aria-hidden>
                  {icon}
                </span>
                <span className="text-xs font-medium text-zinc-600">{label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          {/* 白底液态玻璃侧边分类：桌面可折叠+邻近放大，移动端横向滚动 */}
          <SidebarNav
            categories={categories.map((c) => ({ id: c.id, name: c.name, emoji: categoryEmoji(c.name) }))}
            activeId={activeCategory}
            onSelect={setActiveCategory}
          />
          {/* 商品区：按一张隐形网络（栅格）对齐，等宽等距 */}
          <div className="grid flex-1 grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {shelfProducts.map((product) => (
              <ProductCard key={product.id} product={product} onBuy={handleBuyClick} />
            ))}
          </div>
        </div>

        <Dialog open={isBuyOpen} onOpenChange={setIsBuyOpen}>
          {/* 购买弹窗：浅色液态玻璃 */}
          <DialogContent className="max-h-[90vh] overflow-y-auto border border-white/70 bg-white/80 p-0 shadow-[0_30px_80px_rgba(22,22,40,0.18)] backdrop-blur-2xl sm:max-w-md sm:rounded-3xl">
            {selectedProduct && (
              <div
                className="relative mx-6 mt-6 h-32 overflow-hidden rounded-2xl sm:h-36"
                style={{ background: productVisual(selectedProduct.id).gradient }}
              >
                {selectedProduct.image ? (
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-4xl drop-shadow-sm"
                    aria-hidden
                  >
                    {productVisual(selectedProduct.id).emoji}
                  </span>
                )}
              </div>
            )}
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="text-xl font-semibold tracking-tight text-zinc-900">{selectedProduct?.name}</DialogTitle>
              <p className="text-xs text-zinc-400">{selectedProduct ? `${stockTier(Number(selectedProduct.stock)).sub} · 支付后邮箱收货` : ""}</p>
            </DialogHeader>

            {selectedProduct?.description && (
              <div className="prose prose-sm max-w-none px-6 text-zinc-600">
                <ReactMarkdown>{selectedProduct.description}</ReactMarkdown>
              </div>
            )}

            <div className="space-y-4 px-6 pb-6">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className={cn("text-xs text-zinc-500", emailError && "text-destructive")}
                >
                  接收邮箱 {emailError && <span className="ml-2 font-normal">{emailError}</span>}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-11 rounded-xl border border-zinc-200 bg-white/70 text-zinc-900 shadow-none placeholder:text-zinc-400"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-zinc-500">数量</Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-[15px] font-semibold text-zinc-900">{quantity}</span>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200"
                    onClick={() => setQuantity((value) => Math.min(selectedProduct?.stock || 1, value + 1))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coupon" className="text-xs text-zinc-500">
                  优惠码
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="coupon"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="可选"
                      disabled={!!appliedCoupon}
                      className="h-11 rounded-xl border border-zinc-200 bg-white/70 uppercase text-zinc-900 shadow-none placeholder:text-zinc-400"
                    />
                    {appliedCoupon && <Check className="absolute right-3 top-3.5 h-4 w-4 text-emerald-500" />}
                  </div>
                  {appliedCoupon ? (
                    <Button
                      variant="secondary"
                      className="h-11 rounded-xl border border-zinc-200 bg-white/70 text-zinc-700 hover:bg-zinc-100"
                      onClick={() => {
                        setAppliedCoupon(null)
                        setCouponCode("")
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="h-11 rounded-xl border border-zinc-200 bg-white/70 text-zinc-700 hover:bg-zinc-100"
                      onClick={handleApplyCoupon}
                      disabled={isValidatingCoupon || !couponCode.trim()}
                    >
                      {isValidatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "使用"}
                    </Button>
                  )}
                </div>
                {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                {appliedCoupon && <p className="text-xs text-emerald-500">已减免 ¥{discount.toFixed(2)}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-zinc-500">支付方式</Label>
                {channels.length > 0 ? (
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-2">
                    {channels.map((channel) => (
                      <div key={channel.id}>
                        <RadioGroupItem value={channel.id} id={channel.id} className="peer sr-only" />
                        <Label
                          htmlFor={channel.id}
                          className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200 bg-white/70 px-4 py-3 text-zinc-700 transition hover:border-[#E2725B]/40 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-[#E2725B]"
                        >
                          <span>{channel.name}</span>
                          <span className="flex items-center gap-2">
                            {channel.fee && channel.fee > 0 && (
                              <span className="text-xs text-zinc-400">+{channel.fee}%</span>
                            )}
                            <span
                              className={cn(
                                "h-3.5 w-3.5 rounded-full",
                                paymentMethod === channel.id ? "bg-[#E2725B]" : "border border-zinc-300"
                              )}
                            />
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="rounded-xl border border-zinc-200 bg-white/70 px-4 py-3 text-center text-xs text-destructive">
                    暂无可用支付方式
                  </div>
                )}
              </div>

              {paymentError && <p role="alert" className="text-sm text-destructive">{paymentError}</p>}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-zinc-400">
                  合计{feeAmount > 0 ? ` · 含手续费 ¥${feeAmount.toFixed(2)}` : ""}
                </span>
                <span className="text-xl font-semibold text-zinc-900">¥{finalTotal.toFixed(2)}</span>
              </div>
              <Button
                size="lg"
                className="h-12 w-full rounded-full bg-gradient-to-br from-[#E2725B] to-[#C2553C] text-base text-white shadow-[0_8px_20px_rgba(226,114,91,0.45)] transition-transform duration-200 hover:scale-[1.02] active:scale-95"
                onClick={handlePurchase}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "正在处理..." : "立即支付"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
