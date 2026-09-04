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

// Memoized so clicking a tab / typing in the dialog doesn't re-render every row.
const CategoryTab = memo(function CategoryTab({
  category,
  active,
  onSelect,
}: {
  category: Category
  active: boolean
  onSelect: (id: string) => void
}) {
  const emoji = categoryEmoji(category.name)
  return (
    <button
      type="button"
      onClick={() => onSelect(category.id)}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(214,106,139,0.4)]"
          : "bg-white text-muted-foreground hover:bg-secondary"
      )}
    >
      <span aria-hidden>{emoji}</span>
      <span>{category.name}</span>
    </button>
  )
})

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
        "group relative flex flex-col overflow-hidden rounded-3xl bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        soldOut && "opacity-50"
      )}
    >
      <div className="relative h-40 sm:h-44" style={{ background: v.gradient }}>
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/30 blur-xl" />
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
            soldOut ? "bg-black/40 text-white" : "bg-white/80 text-foreground"
          )}
        >
          {soldOut ? "缺货" : "现货"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-[15px] font-medium">{product.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {soldOut ? "暂时缺货" : `库存 ${product.stock} · 自动发货`}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-medium text-primary">¥{Number(product.price).toFixed(2)}</span>
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
              soldOut
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground group-hover:shadow-[0_6px_16px_rgba(214,106,139,0.45)]"
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

  const allProducts = useMemo(() => categories.flatMap((category) => category.products), [categories])
  const featuredProduct = useMemo(
    () =>
      [...allProducts].sort((a, b) => {
        if (a.stock > 0 && b.stock <= 0) return -1
        if (a.stock <= 0 && b.stock > 0) return 1
        return Number(b.price) - Number(a.price)
      })[0],
    [allProducts]
  )
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
      <div className="py-24 text-center text-muted-foreground">
        <p className="text-2xl font-medium tracking-tight text-foreground">暂无商品上架</p>
        <p className="mt-2 text-sm">商品准备好后会显示在这里</p>
      </div>
    )
  }

  const featuredVisual = featuredProduct ? productVisual(featuredProduct.id) : null

  return (
    <div className="relative w-full">
      <Mascot />
      {/* decorative blur blobs */}
      <div className="pointer-events-none absolute -left-10 -top-6 -z-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 top-48 -z-0 h-48 w-48 rounded-full bg-[#ff9ec1]/20 blur-3xl" />

      <div className="relative z-10">
        {featured && featuredProduct && featuredVisual && (
          <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffd0e3] to-[#ff9ec4] p-6 shadow-sm sm:p-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/40 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-[#ff9ec1]/40 blur-2xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
              <div
                className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-5xl shadow-inner sm:h-32 sm:w-32"
                style={{ background: featuredVisual.gradient }}
              >
                {featuredProduct.image ? (
                  <img src={featuredProduct.image} alt={featuredProduct.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span aria-hidden>{featuredVisual.emoji}</span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-primary">本周主推</p>
                <h1 className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">{featuredProduct.name}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {featuredProduct.stock > 0 ? `现货 ${featuredProduct.stock} 份 · 邮箱自动收货` : "暂时缺货"}
                </p>
              </div>
              <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                <span className="text-2xl font-medium text-primary">¥{Number(featuredProduct.price).toFixed(2)}</span>
                <Button
                  className="h-11 rounded-full px-6 shadow-[0_8px_20px_rgba(214,106,139,0.45)] transition-transform duration-200 hover:scale-[1.03] active:scale-95"
                  disabled={featuredProduct.stock <= 0}
                  onClick={() => handleBuyClick(featuredProduct)}
                >
                  {featuredProduct.stock > 0 ? "立即购买" : "售罄"}
                </Button>
              </div>
            </div>
          </section>
        )}

        {featured && (
          <div className="mb-8 grid grid-cols-3 gap-3">
            {[
              ["⚡", "秒级自动发货"],
              ["🔒", "信息加密保护"],
              ["💬", "7×24 售后"],
            ].map(([icon, label]) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 shadow-sm"
              >
                <span className="text-xl" aria-hidden>
                  {icon}
                </span>
                <span className="text-xs font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-2">
          {categories.map((category) => (
            <CategoryTab
              key={category.id}
              category={category}
              active={activeCategory === category.id}
              onSelect={setActiveCategory}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {shelfProducts.map((product) => (
            <ProductCard key={product.id} product={product} onBuy={handleBuyClick} />
          ))}
        </div>

        <Dialog open={isBuyOpen} onOpenChange={setIsBuyOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto border-none bg-background p-0 sm:max-w-md sm:rounded-3xl">
            {selectedProduct && (
              <div
                className="relative mx-6 mt-6 h-32 overflow-hidden rounded-2xl sm:h-36"
                style={{ background: productVisual(selectedProduct.id).gradient }}
              >
                <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/30 blur-lg" />
                {selectedProduct.image ? (
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="absolute inset-0 h-full w-full object-cover" />
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
              <DialogTitle className="text-xl font-medium tracking-tight">{selectedProduct?.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">库存 {selectedProduct?.stock} · 支付后邮箱收货</p>
            </DialogHeader>

            {selectedProduct?.description && (
              <div className="prose prose-sm max-w-none px-6 text-muted-foreground">
                <ReactMarkdown>{selectedProduct.description}</ReactMarkdown>
              </div>
            )}

            <div className="space-y-4 px-6 pb-6">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className={cn("text-xs text-muted-foreground", emailError && "text-destructive")}
                >
                  接收邮箱 {emailError && <span className="ml-2 font-normal">{emailError}</span>}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-11 rounded-xl border-none bg-white shadow-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">数量</Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-[15px] font-medium">{quantity}</span>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white"
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
                      className="h-11 rounded-xl border-none bg-white uppercase shadow-none"
                    />
                    {appliedCoupon && <Check className="absolute right-3 top-3.5 h-4 w-4 text-emerald-600" />}
                  </div>
                  {appliedCoupon ? (
                    <Button
                      variant="secondary"
                      className="h-11 rounded-xl"
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
                      className="h-11 rounded-xl"
                      onClick={handleApplyCoupon}
                      disabled={isValidatingCoupon || !couponCode.trim()}
                    >
                      {isValidatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "使用"}
                    </Button>
                  )}
                </div>
                {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                {appliedCoupon && <p className="text-xs text-emerald-700">已减免 ¥{discount.toFixed(2)}</p>}
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
                          className="flex cursor-pointer items-center justify-between rounded-xl bg-white px-4 py-3 peer-data-[state=checked]:ring-1 ring-primary"
                        >
                          <span>{channel.name}</span>
                          <span className="flex items-center gap-2">
                            {channel.fee && channel.fee > 0 && (
                              <span className="text-xs text-muted-foreground">+{channel.fee}%</span>
                            )}
                            <span
                              className={cn(
                                "h-3.5 w-3.5 rounded-full",
                                paymentMethod === channel.id ? "bg-primary" : "border border-muted-foreground/40"
                              )}
                            />
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="rounded-xl bg-white px-4 py-3 text-center text-xs text-destructive">
                    暂无可用支付方式
                  </div>
                )}
              </div>

              {paymentError && <p role="alert" className="text-sm text-destructive">{paymentError}</p>}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  合计{feeAmount > 0 ? ` · 含手续费 ¥${feeAmount.toFixed(2)}` : ""}
                </span>
                <span className="text-xl font-medium">¥{finalTotal.toFixed(2)}</span>
              </div>
              <Button
                size="lg"
                className="h-12 w-full rounded-full text-base shadow-[0_8px_20px_rgba(214,106,139,0.45)] transition-transform duration-200 hover:scale-[1.02] active:scale-95"
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
