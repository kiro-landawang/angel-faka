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
  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onBuy(product)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] text-left shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-[#E2725B]/50 hover:shadow-[0_14px_40px_rgba(226,114,91,0.28)]",
        soldOut && "opacity-50"
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
            "absolute left-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur",
            soldOut ? "bg-black/40 text-white" : "bg-white/15 text-white"
          )}
        >
          {soldOut ? "缺货" : "现货"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-[15px] font-medium text-white">{product.name}</p>
        <p className="mt-1 text-xs text-white/50">
          {soldOut ? "暂时缺货" : `库存 ${product.stock} · 自动发货`}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-medium text-[#E2725B]">¥{Number(product.price).toFixed(2)}</span>
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-[box-shadow,transform] duration-200",
              soldOut
                ? "bg-white/10 text-white/50"
                : "bg-gradient-to-br from-[#E2725B] to-[#C2553C] text-white group-hover:shadow-[0_6px_16px_rgba(226,114,91,0.45)]"
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
      <div className="py-24 text-center text-white/60">
        <p className="text-2xl font-medium tracking-tight text-white">暂无商品上架</p>
        <p className="mt-2 text-sm">商品准备好后会显示在这里</p>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <Mascot />

      <div className="relative z-10">
        {featured && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              ["⚡", "秒级自动发货"],
              ["🔒", "信息加密保护"],
              ["💬", "7×24 售后"],
            ].map(([icon, label]) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
              >
                <span className="text-xl" aria-hidden>
                  {icon}
                </span>
                <span className="text-xs font-medium text-white/80">{label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          {/* 固定位置分类侧边栏：可折叠，鼠标靠近放大，当前项赤陶色高亮 */}
          <SidebarNav
            categories={categories.map((c) => ({ id: c.id, name: c.name, emoji: categoryEmoji(c.name) }))}
            activeId={activeCategory}
            onSelect={setActiveCategory}
          />
          {/* 内容区：当前分类下的商品 */}
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shelfProducts.map((product) => (
              <ProductCard key={product.id} product={product} onBuy={handleBuyClick} />
            ))}
          </div>
        </div>

        <Dialog open={isBuyOpen} onOpenChange={setIsBuyOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto border border-white/10 bg-[#0e0d15] p-0 sm:max-w-md sm:rounded-3xl">
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
              <DialogTitle className="text-xl font-medium tracking-tight text-white">{selectedProduct?.name}</DialogTitle>
              <p className="text-xs text-white/50">库存 {selectedProduct?.stock} · 支付后邮箱收货</p>
            </DialogHeader>

            {selectedProduct?.description && (
              <div className="prose prose-sm max-w-none px-6 text-white/70">
                <ReactMarkdown>{selectedProduct.description}</ReactMarkdown>
              </div>
            )}

            <div className="space-y-4 px-6 pb-6">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className={cn("text-xs text-white/50", emailError && "text-destructive")}
                >
                  接收邮箱 {emailError && <span className="ml-2 font-normal">{emailError}</span>}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-11 rounded-xl border border-white/15 bg-white/5 text-white shadow-none placeholder:text-white/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/50">数量</Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    <Minus className="h-3.5 w-3.5 text-white" />
                  </button>
                  <span className="w-6 text-center text-[15px] font-medium text-white">{quantity}</span>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5"
                    onClick={() => setQuantity((value) => Math.min(selectedProduct?.stock || 1, value + 1))}
                  >
                    <Plus className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coupon" className="text-xs text-white/50">
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
                      className="h-11 rounded-xl border border-white/15 bg-white/5 uppercase text-white shadow-none placeholder:text-white/30"
                    />
                    {appliedCoupon && <Check className="absolute right-3 top-3.5 h-4 w-4 text-emerald-400" />}
                  </div>
                  {appliedCoupon ? (
                    <Button
                      variant="secondary"
                      className="h-11 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
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
                      className="h-11 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
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
                <Label className="text-xs text-white/50">支付方式</Label>
                {channels.length > 0 ? (
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-2">
                    {channels.map((channel) => (
                      <div key={channel.id}>
                        <RadioGroupItem value={channel.id} id={channel.id} className="peer sr-only" />
                        <Label
                          htmlFor={channel.id}
                          className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-[#E2725B]"
                        >
                          <span>{channel.name}</span>
                          <span className="flex items-center gap-2">
                            {channel.fee && channel.fee > 0 && (
                              <span className="text-xs text-white/40">+{channel.fee}%</span>
                            )}
                            <span
                              className={cn(
                                "h-3.5 w-3.5 rounded-full",
                                paymentMethod === channel.id ? "bg-[#E2725B]" : "border border-white/40"
                              )}
                            />
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-destructive">
                    暂无可用支付方式
                  </div>
                )}
              </div>

              {paymentError && <p role="alert" className="text-sm text-destructive">{paymentError}</p>}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-white/50">
                  合计{feeAmount > 0 ? ` · 含手续费 ¥${feeAmount.toFixed(2)}` : ""}
                </span>
                <span className="text-xl font-medium text-white">¥{finalTotal.toFixed(2)}</span>
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
