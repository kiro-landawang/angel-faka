"use client"

import { useState, useEffect, useMemo, useCallback, memo } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, Minus, Plus, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

// Lazy-load the heavy markdown renderer so it stays out of the initial bundle
// and is only parsed on demand (when a described product's dialog opens).
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false })

// ---- visual helpers (deterministic, no external image assets needed) ----
const PRODUCT_EMOJIS = ["🎮", "🎬", "🎵", "💻", "📺", "🎁", "⚡", "🌟", "💎", "🎯", "🚀", "🔥"]
function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function productVisual(seed: string) {
  const h = hashStr(seed)
  return { emoji: PRODUCT_EMOJIS[h % PRODUCT_EMOJIS.length] }
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
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white transition-shadow duration-200",
        "hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]",
        soldOut && "opacity-70"
      )}
    >
      <div className="relative">
        {product.image && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-36 w-full bg-gray-50 object-cover sm:h-40"
          />
        ) : (
          <div
            className="flex h-36 w-full items-center justify-center bg-gray-50 text-3xl text-gray-300 sm:h-40"
            aria-hidden
          >
            {v.emoji}
          </div>
        )}
        {/* 角标：自动发货（绿）/ 售罄（灰）—— 对齐独角数卡 Unicorn 的 badge 语义 */}
        {soldOut ? (
          <span className="absolute left-2 top-2 rounded bg-gray-500 px-1.5 py-0.5 text-[11px] font-medium text-white">
            已售罄
          </span>
        ) : (
          <span className="absolute left-2 top-2 rounded bg-emerald-500 px-1.5 py-0.5 text-[11px] font-medium text-white">
            自动发货
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-[14px] font-medium text-gray-900">{product.name}</p>
        <div className="mt-2 flex items-center justify-between gap-1.5">
          {/* 价格：独角数卡 Unicorn 用「绿色描边按钮」呈现，而非红字 */}
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded border border-emerald-500 px-1.5 py-1 text-[12px] font-semibold text-emerald-600 [font-variant-numeric:tabular-nums] sm:px-2 sm:text-[13px]">
            <span className="mr-0.5 text-[10px] sm:text-[11px]">¥</span>
            {Number(product.price).toFixed(2)}
          </span>
          <button
            type="button"
            disabled={soldOut}
            onClick={() => onBuy(product)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity duration-150 sm:px-3 sm:text-[13px]",
              soldOut ? "cursor-not-allowed bg-gray-300" : "hover:opacity-90"
            )}
          >
            {soldOut ? "已售罄" : "立即购买"}
          </button>
        </div>
      </div>
    </div>
  )
})

export function StoreFront({
  categories,
  featured = false,
}: {
  categories: Category[]
  featured?: boolean
}) {
  const [activeCategory, setActiveCategory] = useState("all")
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

  const allProducts = useMemo(
    () => categories.flatMap((c) => c.products),
    [categories]
  )
  const shelfProducts = useMemo(
    () => (activeCategory === "all" ? allProducts : categories.find((c) => c.id === activeCategory)?.products ?? []),
    [categories, activeCategory, allProducts]
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
      <div className="py-24 text-center text-gray-500">
        <p className="text-2xl font-semibold tracking-tight text-gray-900">暂无商品上架</p>
        <p className="mt-2 text-sm">商品准备好后会显示在这里</p>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      {/* 分类区：独角数卡 Unicorn 用「顶部分类胶囊(tab)」而非侧边栏 */}
      <section className="py-7">
        <div className="text-center">
          <h3 className="text-[18px] font-semibold text-gray-900">今日你需要什么？</h3>
          <div className="mx-auto my-3 h-[5px] w-[60px] border border-gray-300 bg-gray-300">
            <span className="block h-[5px] w-[30px] bg-gray-900" />
          </div>
          <p className="text-sm text-gray-500">支付完成立即自动发货 · 安全 · 稳定</p>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={cn(
              "rounded-full border px-4 py-1.5 text-[13px] transition-colors",
              activeCategory === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-gray-300 text-gray-600 hover:border-primary hover:text-primary"
            )}
          >
            全部
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-[13px] transition-colors",
                activeCategory === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-gray-300 text-gray-600 hover:border-primary hover:text-primary"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </section>

      {/* 商品网格：独角数卡 Unicorn 默认 2 列(移动)/5 列(桌面) 白卡 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shelfProducts.map((product) => (
          <ProductCard key={product.id} product={product} onBuy={handleBuyClick} />
        ))}
      </div>

      <Dialog open={isBuyOpen} onOpenChange={setIsBuyOpen}>
        {/* 购买弹窗：白卡 + 圆角 6px，对齐独角数卡 buy 表单 */}
        <DialogContent className="max-h-[90vh] overflow-y-auto border border-gray-200 bg-white p-0 text-gray-900 shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:max-w-md sm:rounded-md">
          {selectedProduct && (
            <div
              className="relative mx-5 mt-5 h-28 overflow-hidden rounded-md bg-gray-50 sm:h-32"
            >
              {selectedProduct.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.currentTarget.style.display = "none" }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-3xl text-gray-300">
                  {productVisual(selectedProduct.id).emoji}
                </span>
              )}
            </div>
          )}
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-lg font-semibold text-gray-900">{selectedProduct?.name}</DialogTitle>
            <p className="text-xs text-gray-500">支付后邮箱自动收货 · 自动发货</p>
          </DialogHeader>

          {selectedProduct?.description && (
            <div className="prose prose-sm max-w-none px-5 text-gray-600">
              <ReactMarkdown>{selectedProduct.description}</ReactMarkdown>
            </div>
          )}

          <div className="space-y-4 px-5 pb-5">
            <div className="space-y-2">
              {account ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">收货邮箱（登录账户）</p>
                  <p className="mt-0.5 text-[15px] font-medium text-gray-900 break-all">{account.email}</p>
                </div>
              ) : (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
                  <p className="text-sm text-gray-900">
                    需要先 <a href="/login" className="font-semibold text-primary underline-offset-2 hover:underline">登录账户</a> 才能购买
                  </p>
                  <p className="mt-1 text-xs text-gray-500">登录后购买卡密即送抽奖次数，可抽积分再兑换卡密</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-500">数量</Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 transition-colors hover:border-primary hover:text-primary"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-[15px] font-semibold text-gray-900 [font-variant-numeric:tabular-nums]">{quantity}</span>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 transition-colors hover:border-primary hover:text-primary"
                  onClick={() => setQuantity((value) => Math.min(selectedProduct?.stock || 1, value + 1))}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon" className="text-xs text-gray-500">
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
                    className="h-11 rounded-md border-gray-200 bg-gray-50 uppercase text-gray-900 shadow-none placeholder:text-gray-400"
                  />
                  {appliedCoupon && <Check className="absolute right-3 top-3.5 h-4 w-4 text-emerald-500" />}
                </div>
                {appliedCoupon ? (
                  <Button
                    variant="secondary"
                    className="h-11 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
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
                    className="h-11 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    onClick={handleApplyCoupon}
                    disabled={isValidatingCoupon || !couponCode.trim()}
                  >
                    {isValidatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "使用"}
                  </Button>
                )}
              </div>
              {couponError && <p className="text-xs text-destructive">{couponError}</p>}
              {appliedCoupon && <p className="text-xs text-emerald-600">已减免 ¥{discount.toFixed(2)}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-500">支付方式</Label>
              {channels.length > 0 ? (
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-2">
                  {channels.map((channel) => (
                    <div key={channel.id}>
                      <RadioGroupItem value={channel.id} id={channel.id} className="peer sr-only" />
                      <Label
                        htmlFor={channel.id}
                        className="flex cursor-pointer items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-colors hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-primary"
                      >
                        <span>{channel.name}</span>
                        <span className="flex items-center gap-2">
                          {Number(channel.fee ?? 0) > 0 && (
                            <span className="text-xs text-gray-500">+{channel.fee}%</span>
                          )}
                          <span
                            className={cn(
                              "h-3.5 w-3.5 rounded-full",
                              paymentMethod === channel.id ? "bg-primary" : "border border-gray-300"
                            )}
                          />
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs text-destructive">
                  暂无可用支付方式
                </div>
              )}
            </div>

            {paymentError && <p role="alert" className="text-sm text-destructive">{paymentError}</p>}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500">
                合计{feeAmount > 0 ? ` · 含手续费 ¥${feeAmount.toFixed(2)}` : ""}
              </span>
              <span className="text-xl font-semibold text-gray-900 [font-variant-numeric:tabular-nums]">¥{finalTotal.toFixed(2)}</span>
            </div>
            <Button
              size="lg"
              className="h-12 w-full rounded-md bg-primary text-base text-primary-foreground transition-opacity hover:opacity-90"
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
  )
}
