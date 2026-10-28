"use client"

import { useState, useEffect, useMemo, useCallback, memo } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, Minus, Plus, Check, X } from "lucide-react"
import { SidebarNav } from "@/components/sidebar-nav"
import { cn } from "@/lib/utils"

// Lazy-load the heavy markdown renderer so it stays out of the initial bundle
// and is only parsed on demand (when a described product's dialog opens).
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false })

// ---- visual helpers (deterministic, no external image assets needed) ----
const PRODUCT_EMOJIS = ["🎮", "🎬", "🎵", "💻", "📺", "🎁", "⚡", "🌟", "💎", "🎯", "🚀", "🔥"]
// 浅色柔光（radial-gradient 只画一次，无滤镜无动画），按商品 ID 稳定分配
const PRODUCT_GLOWS = [
  "radial-gradient(circle at 30% 22%, rgba(59,130,246,0.14), transparent 66%)",   // 蓝
  "radial-gradient(circle at 70% 24%, rgba(139,92,246,0.12), transparent 66%)",   // 紫
  "radial-gradient(circle at 50% 30%, rgba(16,185,129,0.12), transparent 66%)",   // 绿
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

// 独角式徽章系统：库存分级 + 交付方式（语义色浅色胶囊）
function stockTier(stock: number) {
  if (stock <= 0)
    return { label: "售空", badge: "border border-zinc-200 bg-zinc-100 text-muted-foreground", sub: "补货中 · 可订阅提醒" }
  if (stock < 10)
    return { label: "有库存", badge: "border border-amber-200 bg-amber-50 text-amber-600", sub: "库存紧张 · 自动发货" }
  return { label: "有库存", badge: "border border-emerald-200 bg-emerald-50 text-emerald-600", sub: "库存充足 · 自动发货" }
}

// 徽章胶囊统一样式（独角 classic 风小圆胶囊）
const CHIP = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium"

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
  categoryName,
  onBuy,
}: {
  product: Product
  categoryName?: string
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
        // 独角式白卡：静态零阴影，hover 才浮起；阴影用伪元素预烘焙切 opacity，
        // 全程只动 transform + opacity（合成器线程），不触发 box-shadow 过渡重绘
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left",
        "transition-[transform,border-color] duration-200 ease-out",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:shadow-[0_14px_36px_rgba(15,23,42,0.10)] before:opacity-0 before:transition-opacity before:duration-200",
        "hover:-translate-y-1 hover:border-primary/30 hover:before:opacity-100",
        soldOut && "opacity-60"
      )}
    >
      <div className="relative h-36 sm:h-40">
        {/* 专属色柔光：按商品 ID 稳定分配蓝/紫/绿 */}
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
          <span className="absolute inset-0 flex items-center justify-center text-5xl" aria-hidden>
            {v.emoji}
          </span>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          {categoryName && (
            <span className={cn(CHIP, "border-blue-200 bg-blue-50 text-blue-600")}>{categoryName}</span>
          )}
          <span className={cn(CHIP, tier.badge)}>{tier.label}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn(CHIP, "border-primary/25 bg-primary/5 text-primary")}>⚡ 自动发货</span>
          <span className={cn(CHIP, "border-zinc-200 bg-zinc-50 text-muted-foreground")}>🔐 登录购买</span>
        </div>
        <p className="mt-2 truncate text-[15.5px] font-semibold tracking-[-0.015em] text-foreground">{product.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {tier.sub}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3.5">
          <span className="font-ark text-[22px] font-bold tracking-[0.01em] text-foreground [font-variant-numeric:tabular-nums]">
            <span className="mr-0.5 align-baseline text-[13px] font-semibold text-muted-foreground">¥</span>
            {Number(product.price).toFixed(2)}
          </span>
          <span
            className={cn(
              "flex h-9 items-center rounded-full px-4 text-[13px] font-semibold transition-opacity duration-200",
              soldOut ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground group-hover:opacity-90"
            )}
          >
            {soldOut ? "售罄" : "购买 →"}
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
  const [quantity, setQuantity] = useState(1)
  const [couponCode, setCouponCode] = useState("")
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discountType: "FIXED" | "PERCENTAGE"
    discountValue: number
  } | null>(null)
  const [couponError, setCouponError] = useState("")
  const [paymentError, setPaymentError] = useState("")
  const [account, setAccount] = useState<{ email: string } | null>(null)

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
    fetch("/api/customer/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAccount({ email: d.email }) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isBuyOpen) {
      setCouponCode("")
      setAppliedCoupon(null)
      setCouponError("")
      setPaymentError("")
    }
  }, [isBuyOpen])

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
    // 抽奖 / 积分体系：必须先登录才能下单
    if (!account) {
      if (confirm("下单需要先登录账户（用于发放抽奖次数与积分）。是否前往登录？")) {
        window.location.href = "/login"
      }
      return
    }
    if (!paymentMethod) {
      alert("请选择支付方式")
      return
    }

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
      <div className="py-24 text-center text-muted-foreground">
        <p className="text-2xl font-semibold tracking-tight text-foreground">暂无商品上架</p>
        <p className="mt-2 text-sm">商品准备好后会显示在这里</p>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div className="relative z-10 pt-3">
        {featured && featureProduct && (
          /* 主推位：蓝紫渐变描边宽卡，首屏视觉锚点 */
          <div className="mb-7 rounded-2xl bg-[linear-gradient(120deg,rgba(59,130,246,0.5),rgba(139,92,246,0.35)_55%,rgba(16,185,129,0.4))] p-px">
            <div className="flex flex-wrap items-center gap-x-7 gap-y-4 rounded-[15px] bg-card px-6 py-5 sm:px-7">
              <div
                className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-2xl border border-primary/20 text-4xl"
                style={{
                  background: "radial-gradient(circle at 30% 25%, rgba(59,130,246,0.16), rgba(59,130,246,0.04) 70%)",
                }}
                aria-hidden
              >
                {productVisual(featureProduct.id).emoji}
              </div>
              <div className="min-w-0">
                <span className="inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold tracking-[0.1em] text-primary-foreground">
                  本周主推
                </span>
                <h3 className="mt-2 truncate text-[19px] font-extrabold tracking-[-0.025em] text-foreground">
                  {featureProduct.name}
                </h3>
                <p className="mt-0.5 text-[13.5px] text-muted-foreground">全场主推 · 支付后自动发货</p>
              </div>
              <div className="ml-auto flex items-center gap-5">
                <span className="font-ark text-[30px] font-bold tracking-[0.01em] text-foreground [font-variant-numeric:tabular-nums]">
                  <span className="mr-0.5 align-baseline text-[16px] font-semibold text-muted-foreground">¥</span>
                  {Number(featureProduct.price).toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => handleBuyClick(featureProduct)}
                  className="rounded-full bg-primary px-7 py-2.5 text-[14.5px] font-bold text-primary-foreground transition-all duration-150 hover:opacity-90 hover:shadow-[0_8px_24px_rgba(59,130,246,0.35)] active:translate-y-0"
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
              <ProductCard
                key={product.id}
                product={product}
                categoryName={currentCategory?.name}
                onBuy={handleBuyClick}
              />
            ))}
          </div>
        </div>

        <Dialog open={isBuyOpen} onOpenChange={setIsBuyOpen}>
          {/* 购买弹窗：暗玻璃（去 backdrop-blur：大面积模糊在低端机上掉帧） */}
          <DialogContent className="max-h-[90vh] overflow-y-auto border border-border bg-card p-0 text-card-foreground shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:max-w-md sm:rounded-[18px]">
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
                    
                    aria-hidden
                  >
                    {productVisual(selectedProduct.id).emoji}
                  </span>
                )}
              </div>
            )}
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">{selectedProduct?.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">{selectedProduct ? `${stockTier(Number(selectedProduct.stock)).sub} · 支付后邮箱收货` : ""}</p>
            </DialogHeader>

            {selectedProduct?.description && (
              <div className="prose prose-sm max-w-none px-6 text-muted-foreground">
                <ReactMarkdown>{selectedProduct.description}</ReactMarkdown>
              </div>
            )}

            <div className="space-y-4 px-6 pb-6">
              <div className="space-y-2">
                {account ? (
                  <div className="rounded-xl border border-border bg-muted/50 px-4 py-3">
                    <p className="text-xs text-muted-foreground">收货邮箱（登录账户）</p>
                    <p className="mt-0.5 text-[15px] font-medium text-foreground break-all">{account.email}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                    <p className="text-sm text-foreground">
                      需要先 <a href="/login" className="font-semibold text-primary underline-offset-2 hover:underline">登录账户</a> 才能购买
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">登录后购买卡密即送抽奖次数，可抽积分再兑换卡密</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">数量</Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-[15px] font-semibold text-foreground [font-variant-numeric:tabular-nums]">{quantity}</span>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted"
                    onClick={() => setQuantity((value) => Math.min(selectedProduct?.stock || 1, value + 1))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coupon" className="text-xs text-muted-foreground">
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
                      className="h-11 rounded-xl border border-border bg-muted/50 uppercase text-foreground shadow-none placeholder:text-muted-foreground"
                    />
                    {appliedCoupon && <Check className="absolute right-3 top-3.5 h-4 w-4 text-emerald-400" />}
                  </div>
                  {appliedCoupon ? (
                    <Button
                      variant="secondary"
                      className="h-11 rounded-xl border border-border bg-muted/60 text-foreground hover:bg-muted"
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
                      className="h-11 rounded-xl border border-border bg-muted/60 text-foreground hover:bg-muted"
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
                <Label className="text-xs text-muted-foreground">支付方式</Label>
                {channels.length > 0 ? (
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-2">
                    {channels.map((channel) => (
                      <div key={channel.id}>
                        <RadioGroupItem value={channel.id} id={channel.id} className="peer sr-only" />
                        <Label
                          htmlFor={channel.id}
                          className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3 text-foreground transition-colors hover:border-white/20 peer-data-[state=checked]:border-primary/50 peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-primary"
                        >
                          <span>{channel.name}</span>
                          <span className="flex items-center gap-2">
                            {Number(channel.fee ?? 0) > 0 && (
                              <span className="text-xs text-muted-foreground">+{channel.fee}%</span>
                            )}
                            <span
                              className={cn(
                                "h-3.5 w-3.5 rounded-full",
                                paymentMethod === channel.id ? "bg-primary" : "border border-zinc-300"
                              )}
                            />
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-center text-xs text-destructive">
                    暂无可用支付方式
                  </div>
                )}
              </div>

              {paymentError && <p role="alert" className="text-sm text-destructive">{paymentError}</p>}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  合计{feeAmount > 0 ? ` · 含手续费 ¥${feeAmount.toFixed(2)}` : ""}
                </span>
                <span className="text-xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">¥{finalTotal.toFixed(2)}</span>
              </div>
              <Button
                size="lg"
                className="h-12 w-full rounded-xl bg-primary text-base text-primary-foreground shadow-[0_10px_30px_rgba(59,130,246,0.30)] transition-all duration-150 hover:opacity-90 active:translate-y-0"
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
