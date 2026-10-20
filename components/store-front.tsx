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
// 三种静态光斑色（radial-gradient 只画一次，无滤镜无动画），按商品 ID 稳定分配
const PRODUCT_GLOWS = [
  "radial-gradient(circle at 30% 22%, rgba(226,114,91,0.34), transparent 66%)",   // 陶土
  "radial-gradient(circle at 70% 24%, rgba(120,80,220,0.32), transparent 66%)",   // 紫
  "radial-gradient(circle at 50% 30%, rgba(64,150,255,0.28), transparent 66%)",   // 蓝
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
    glow: PRODUCT_GLOWS[h % PRODUCT_GLOWS.length],
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

// 库存概况分级（语义色）：售空=灰、少量=琥珀、有货=绿
function stockTier(stock: number) {
  if (stock <= 0)
    return { label: "售空", badge: "border border-white/10 bg-white/[0.06] text-zinc-400", sub: "补货中 · 可订阅提醒" }
  if (stock < 10)
    return { label: "少量", badge: "border border-amber-400/30 bg-amber-400/10 text-amber-300", sub: "库存紧张 · 自动发货" }
  return { label: "有货", badge: "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300", sub: "库存充足 · 自动发货" }
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
        // 暗玻璃卡：静态零阴影，hover 才浮起；阴影用伪元素预烘焙切 opacity，
        // 全程只动 transform + opacity（合成器线程），不触发 box-shadow 过渡重绘
        "group relative flex flex-col overflow-hidden rounded-[18px] border border-white/[0.08] bg-card text-left",
        "transition-[transform,border-color] duration-200 ease-out",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:shadow-[0_18px_48px_rgba(0,0,0,0.55)] before:opacity-0 before:transition-opacity before:duration-200",
        "hover:-translate-y-1 hover:border-white/20 hover:before:opacity-100",
        soldOut && "opacity-55"
      )}
    >
      <div className="relative h-40 sm:h-44">
        {/* 专属色光斑：按商品 ID 稳定分配陶土/紫/蓝 */}
        <div className="absolute inset-0" style={{ background: v.glow }} aria-hidden />
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
          <span
            className="absolute inset-0 flex items-center justify-center text-5xl"
            style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.5))" }}
            aria-hidden
          >
            {v.emoji}
          </span>
        )}
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            tier.badge
          )}
        >
          {tier.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-[15.5px] font-semibold tracking-[-0.015em] text-zinc-100">{product.name}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {tier.sub}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3.5">
          <span className="text-[20px] font-extrabold tracking-[-0.02em] text-zinc-50 [font-variant-numeric:tabular-nums]">
            <span className="mr-0.5 align-baseline text-[13px] font-bold text-zinc-500">¥</span>
            {Number(product.price).toFixed(2)}
          </span>
          <span
            className={cn(
              "rounded-[10px] border px-4 py-1.5 text-[13px] font-semibold transition-[background-color,border-color,color] duration-200",
              soldOut
                ? "border-white/10 bg-white/[0.04] text-zinc-600"
                : "border-white/15 bg-white/[0.06] text-zinc-200 group-hover:border-transparent group-hover:bg-gradient-to-br group-hover:from-[#E2725B] group-hover:to-[#C2553C] group-hover:text-white"
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
  // 主推位：全场第一个有库存的商品（确定性取值，随库存自动更替）
  const featureProduct = useMemo(
    () => categories.flatMap((c) => c.products).find((p) => p.stock > 0) ?? null,
    [categories]
  )
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
        <p className="text-2xl font-semibold tracking-tight text-zinc-100">暂无商品上架</p>
        <p className="mt-2 text-sm">商品准备好后会显示在这里</p>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <Mascot />

      <div className="relative z-10 pt-3">
        {featured && featureProduct && (
          /* 主推位：1px 渐变描边宽卡（静态），首屏视觉锚点 */
          <div className="mb-7 rounded-[18px] bg-[linear-gradient(120deg,rgba(226,114,91,0.55),rgba(255,255,255,0.10)_38%,rgba(160,110,255,0.45))] p-px">
            <div className="flex flex-wrap items-center gap-x-7 gap-y-4 rounded-[17px] bg-[linear-gradient(120deg,#1C1518,#141417_55%,#16131C)] px-6 py-5 sm:px-7">
              <div
                className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-2xl border border-[#E2725B]/30 text-4xl"
                style={{
                  background: "radial-gradient(circle at 30% 25%, rgba(226,114,91,0.30), rgba(226,114,91,0.06) 70%)",
                }}
                aria-hidden
              >
                {productVisual(featureProduct.id).emoji}
              </div>
              <div className="min-w-0">
                <span className="inline-block rounded-full border border-primary/40 px-2.5 py-0.5 text-[11px] font-bold tracking-[0.1em] text-primary">
                  本周主推
                </span>
                <h3 className="mt-2 truncate text-[19px] font-extrabold tracking-[-0.025em] text-zinc-50">
                  {featureProduct.name}
                </h3>
                <p className="mt-0.5 text-[13.5px] text-zinc-400">全场主推 · 支付后自动发货</p>
              </div>
              <div className="ml-auto flex items-center gap-5">
                <span className="text-[28px] font-extrabold tracking-[-0.03em] text-zinc-50 [font-variant-numeric:tabular-nums]">
                  <span className="mr-0.5 align-baseline text-[16px] font-bold text-zinc-500">¥</span>
                  {Number(featureProduct.price).toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => handleBuyClick(featureProduct)}
                  className="rounded-xl bg-gradient-to-br from-[#E2725B] to-[#C2553C] px-6 py-2.5 text-[14.5px] font-bold text-white shadow-[0_10px_34px_rgba(226,114,91,0.34)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0"
                >
                  抢购
                </button>
              </div>
            </div>
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
          {/* 购买弹窗：暗玻璃（去 backdrop-blur：大面积模糊在低端机上掉帧） */}
          <DialogContent className="max-h-[90vh] overflow-y-auto border border-border bg-card p-0 text-card-foreground shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:max-w-md sm:rounded-[18px]">
            {selectedProduct && (
              <div
                className="relative mx-6 mt-6 h-32 overflow-hidden rounded-2xl sm:h-36"
                style={{ background: productVisual(selectedProduct.id).glow }}
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
                    className="absolute inset-0 flex items-center justify-center text-4xl"
                    style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.5))" }}
                    aria-hidden
                  >
                    {productVisual(selectedProduct.id).emoji}
                  </span>
                )}
              </div>
            )}
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="text-xl font-semibold tracking-tight text-zinc-50">{selectedProduct?.name}</DialogTitle>
              <p className="text-xs text-zinc-500">{selectedProduct ? `${stockTier(Number(selectedProduct.stock)).sub} · 支付后邮箱收货` : ""}</p>
            </DialogHeader>

            {selectedProduct?.description && (
              <div className="prose prose-sm prose-invert max-w-none px-6 text-zinc-400">
                <ReactMarkdown>{selectedProduct.description}</ReactMarkdown>
              </div>
            )}

            <div className="space-y-4 px-6 pb-6">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className={cn("text-xs text-zinc-400", emailError && "text-destructive")}
                >
                  接收邮箱 {emailError && <span className="ml-2 font-normal">{emailError}</span>}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-11 rounded-xl border border-white/10 bg-white/[0.05] text-zinc-100 shadow-none placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">数量</Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-zinc-300 transition-colors hover:bg-white/[0.12]"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-[15px] font-semibold text-zinc-100 [font-variant-numeric:tabular-nums]">{quantity}</span>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-zinc-300 transition-colors hover:bg-white/[0.12]"
                    onClick={() => setQuantity((value) => Math.min(selectedProduct?.stock || 1, value + 1))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coupon" className="text-xs text-zinc-400">
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
                      className="h-11 rounded-xl border border-white/10 bg-white/[0.05] uppercase text-zinc-100 shadow-none placeholder:text-zinc-500"
                    />
                    {appliedCoupon && <Check className="absolute right-3 top-3.5 h-4 w-4 text-emerald-400" />}
                  </div>
                  {appliedCoupon ? (
                    <Button
                      variant="secondary"
                      className="h-11 rounded-xl border border-white/10 bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12]"
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
                      className="h-11 rounded-xl border border-white/10 bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12]"
                      onClick={handleApplyCoupon}
                      disabled={isValidatingCoupon || !couponCode.trim()}
                    >
                      {isValidatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "使用"}
                    </Button>
                  )}
                </div>
                {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                {appliedCoupon && <p className="text-xs text-emerald-400">已减免 ¥{discount.toFixed(2)}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">支付方式</Label>
                {channels.length > 0 ? (
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-2">
                    {channels.map((channel) => (
                      <div key={channel.id}>
                        <RadioGroupItem value={channel.id} id={channel.id} className="peer sr-only" />
                        <Label
                          htmlFor={channel.id}
                          className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-zinc-300 transition-colors hover:border-white/20 peer-data-[state=checked]:border-primary/50 peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-primary"
                        >
                          <span>{channel.name}</span>
                          <span className="flex items-center gap-2">
                            {Number(channel.fee ?? 0) > 0 && (
                              <span className="text-xs text-zinc-500">+{channel.fee}%</span>
                            )}
                            <span
                              className={cn(
                                "h-3.5 w-3.5 rounded-full",
                                paymentMethod === channel.id ? "bg-primary" : "border border-zinc-600"
                              )}
                            />
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-xs text-destructive">
                    暂无可用支付方式
                  </div>
                )}
              </div>

              {paymentError && <p role="alert" className="text-sm text-destructive">{paymentError}</p>}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-zinc-500">
                  合计{feeAmount > 0 ? ` · 含手续费 ¥${feeAmount.toFixed(2)}` : ""}
                </span>
                <span className="text-xl font-semibold text-zinc-50 [font-variant-numeric:tabular-nums]">¥{finalTotal.toFixed(2)}</span>
              </div>
              <Button
                size="lg"
                className="h-12 w-full rounded-xl bg-gradient-to-br from-[#E2725B] to-[#C2553C] text-base text-white shadow-[0_10px_34px_rgba(226,114,91,0.34)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0"
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
