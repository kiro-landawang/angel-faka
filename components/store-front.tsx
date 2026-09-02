"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, Minus, Plus, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"

interface Product {
  id: string
  name: string
  description: string | null
  price: string
  stock: number
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

  const allProducts = categories.flatMap((category) => category.products)
  const featuredProduct = [...allProducts].sort((a, b) => {
    if (a.stock > 0 && b.stock <= 0) return -1
    if (a.stock <= 0 && b.stock > 0) return 1
    return Number(b.price) - Number(a.price)
  })[0]
  const currentCategory = categories.find((category) => category.id === activeCategory) ?? categories[0]
  const shelfProducts = currentCategory?.products ?? []
  const selectedChannel = channels.find((channel) => channel.id === paymentMethod)
  const subtotal = selectedProduct ? Number(selectedProduct.price) * quantity : 0
  let discount = 0
  if (appliedCoupon) {
    discount = appliedCoupon.discountType === "PERCENTAGE"
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

  const handleBuyClick = (product: Product) => {
    if (product.stock <= 0) return
    setSelectedProduct(product)
    setQuantity(1)
    setIsBuyOpen(true)
  }

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
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "下单失败")
        return
      }
      if (data.payUrl) window.location.href = data.payUrl
    } catch (error) {
      console.error(error)
      alert("系统错误")
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

  return (
    <div className="w-full">
      {featured && featuredProduct && (
        <section className="mb-12">
          <p className="text-xs text-muted-foreground">本周主推</p>
          <h1 className="mt-3 max-w-xl text-4xl font-medium tracking-tight sm:text-5xl">
            {featuredProduct.name}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {featuredProduct.stock > 0 ? `现货 ${featuredProduct.stock} 份 · 邮箱自动收货` : "暂时缺货"}
          </p>
          <div className="mt-6 flex items-center gap-4">
            <span className="text-2xl font-medium">¥{Number(featuredProduct.price).toFixed(2)}</span>
            <Button
              className="h-11 rounded-full px-5"
              disabled={featuredProduct.stock <= 0}
              onClick={() => handleBuyClick(featuredProduct)}
            >
              {featuredProduct.stock > 0 ? "立即购买" : "售罄"}
            </Button>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {categories.slice(0, 3).map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className="rounded-2xl bg-white px-4 py-4 text-left"
              >
                <p className="text-xs text-muted-foreground">{category.name}</p>
                <p className="mt-1 text-sm font-medium">{category.products[0]?.name || "暂无商品"}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.id)}
            className={cn(
              "rounded-full px-4 py-2 text-xs",
              activeCategory === category.id ? "bg-foreground text-background" : "bg-white text-muted-foreground"
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {shelfProducts.map((product) => (
          <button
            key={product.id}
            type="button"
            disabled={product.stock <= 0}
            onClick={() => handleBuyClick(product)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 text-left",
              product.stock <= 0 && "opacity-45"
            )}
          >
            <div>
              <p className="text-[15px] font-medium">{product.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {product.stock > 0 ? `库存 ${product.stock} · 自动发货` : "暂时缺货"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-base font-medium">¥{Number(product.price).toFixed(2)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{product.stock > 0 ? "购买" : "售罄"}</p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={isBuyOpen} onOpenChange={setIsBuyOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-none bg-[#F6F6F4] p-0 sm:max-w-md sm:rounded-3xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-medium tracking-tight">{selectedProduct?.name}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              库存 {selectedProduct?.stock} · 支付后邮箱收货
            </p>
          </DialogHeader>

          {selectedProduct?.description && (
            <div className="prose prose-sm max-w-none px-6 text-muted-foreground">
              <ReactMarkdown>{selectedProduct.description}</ReactMarkdown>
            </div>
          )}

          <div className="space-y-4 px-6 pb-6">
            <div className="space-y-2">
              <Label htmlFor="email" className={cn("text-xs text-muted-foreground", emailError && "text-destructive")}>
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
              <Label htmlFor="coupon" className="text-xs text-muted-foreground">优惠码</Label>
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
                  <Button variant="secondary" className="h-11 rounded-xl" onClick={() => { setAppliedCoupon(null); setCouponCode("") }}>
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="secondary" className="h-11 rounded-xl" onClick={handleApplyCoupon} disabled={isValidatingCoupon || !couponCode.trim()}>
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
                        className="flex cursor-pointer items-center justify-between rounded-xl bg-white px-4 py-3 peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-foreground"
                      >
                        <span>{channel.name}</span>
                        <span className="flex items-center gap-2">
                          {channel.fee && channel.fee > 0 && <span className="text-xs text-muted-foreground">+{channel.fee}%</span>}
                          <span className={cn("h-3.5 w-3.5 rounded-full", paymentMethod === channel.id ? "bg-foreground" : "border border-muted-foreground/40")} />
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="rounded-xl bg-white px-4 py-3 text-center text-xs text-destructive">暂无可用支付方式</div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">合计{feeAmount > 0 ? ` · 含手续费 ¥${feeAmount.toFixed(2)}` : ""}</span>
              <span className="text-xl font-medium">¥{finalTotal.toFixed(2)}</span>
            </div>
            <Button size="lg" className="h-12 w-full rounded-full text-base" onClick={handlePurchase} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "正在处理..." : "立即支付"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
