"use client"

import { useState, useEffect, memo, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { Plus, Edit2, Trash2, Loader2, Key, ChevronLeft, ChevronRight, Filter, ImageIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { StockManager } from "@/components/admin/stock-manager"

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  description: string | null
  price: string
  categoryId: string
  category: Category
  isActive: boolean
  deliveryFormat: string
  allowResale: boolean
  resalePrice?: string | null
  resaleMinPrice?: string | null
  sourceProductId?: string | null
  sourcePrice?: string | null
  image?: string | null
  _count: {
    licenses: number
  }
}

// Compress the selected image client-side to a small JPEG data URL so it fits
// comfortably inside the SystemSetting row (server caps base64 at 4.5MB; we target
// ~400KB to leave headroom). JPEG drops transparency but is fine for product cards.
const MAX_DIM = 512
const MAX_BYTES = 400_000

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("请选择图片文件"))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("读取文件失败"))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("图片解析失败"))
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("无法创建画布"))
          return
        }
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        let quality = 0.85
        let dataUrl = canvas.toDataURL("image/jpeg", quality)
        while (dataUrl.length > MAX_BYTES && quality > 0.4) {
          quality -= 0.1
          dataUrl = canvas.toDataURL("image/jpeg", quality)
        }
        resolve(dataUrl)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

// Lazy-load the heavy WYSIWYG editor (keeps it out of the initial admin chunk,
// like the storefront did with react-markdown) and memoize it so typing in other
// form fields (name/price) doesn't re-render the editor on every keystroke.
const RichTextEditor = dynamic(
  () => import("@/components/ui/rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        编辑器加载中…
      </div>
    ),
  }
)
const MemoRichTextEditor = memo(RichTextEditor)

const ProductRow = memo(function ProductRow({
  product,
  image,
  onToggle,
  onEdit,
  onDelete,
  onStock,
}: {
  product: Product
  image?: string
  onToggle: (id: string, current: boolean) => void
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
  onStock: (product: Product) => void
}) {
  return (
    <TableRow className="hover:bg-muted/40 transition-colors h-24 group">
      <TableCell className="py-4 relative">
        {/* 侧边装饰条 */}
        <div className="absolute left-0 top-4 bottom-4 w-1 bg-primary rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex items-center gap-3 pl-2">
          {image ? (
            <img
              src={image}
              alt={product.name}
              className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xl font-black text-slate-50 tracking-tight drop-shadow-sm leading-tight">
              {product.name}
            </span>
            <div className="flex items-center gap-2">
              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono select-all">
                ID: {product.id}
              </code>
              <span className="text-xs text-muted-foreground/60 line-clamp-1 italic font-medium">
                {product.description || "暂无描述"}
              </span>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="bg-secondary/50 border-border/50 text-xs font-normal">
          {product.category.name}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-lg font-bold text-primary tracking-tight">
          ¥{Number(product.price).toFixed(2)}
        </span>
      </TableCell>
      <TableCell>
        <div className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
          product._count.licenses === 0
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : "bg-green-500/10 text-green-500 border-green-500/20"
        )}>
          {`库存: ${product._count.licenses}`}
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={product.isActive}
          onCheckedChange={() => onToggle(product.id, product.isActive)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 px-2 lg:px-3 bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20"
            onClick={() => onStock(product)}
          >
            <Key className="h-3.5 w-3.5 mr-1" />
            库存
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 px-2 lg:px-3 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
            onClick={() => onEdit(product)}
          >
            <Edit2 className="h-3.5 w-3.5 mr-1" />
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 lg:px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(product.id)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            删除
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
})

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [submitLoading, setSubmitLoading] = useState(false)
  
  // Filter & Pagination State
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Stock State
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [isStockOpen, setIsStockOpen] = useState(false)
  
  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    deliveryFormat: "SINGLE",
    allowResale: false,
    resalePrice: "",
    resaleMinPrice: ""
  })
  const [submitError, setSubmitError] = useState("")

  // Image upload state (display-only; stored as base64 data URL in SystemSetting)
  const [images, setImages] = useState<Record<string, string>>({})
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState("")

  useEffect(() => {
    fetchData()
  }, [page, selectedCategory])

  const fetchData = async () => {
    setLoading(true)
    setLoadError("")
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        categoryId: selectedCategory
      })

      const [prodRes, catRes] = await Promise.all([
        fetch(`/api/admin/products?${queryParams}`),
        fetch("/api/admin/categories")
      ])
      
      const prodData = await prodRes.json().catch(() => ({}))
      const catData = await catRes.json().catch(() => ({}))

      if (!prodRes.ok) {
        setProducts([])
        setTotalPages(1)
        setLoadError(prodRes.status === 401 ? "登录已失效，请重新登录" : `商品加载失败（HTTP ${prodRes.status}）`)
      } else {
        const list = prodData.products || []
        setProducts(list)
        setTotalPages(prodData.pagination?.pages || 1)
        // Load thumbnails for the current page of products.
        const map: Record<string, string> = {}
        await Promise.all(
          list.map(async (p: { id: string }) => {
            try {
              const r = await fetch(`/api/admin/products/${p.id}/image`)
              if (r.ok) {
                const d = await r.json()
                if (d.image) map[p.id] = d.image
              }
            } catch {}
          })
        )
        setImages((prev) => ({ ...prev, ...map }))
      }
      if (catRes.ok) {
        setCategories(catData.items || [])
      }
    } catch (error) {
      console.error(error)
      setProducts([])
      setTotalPages(1)
      setLoadError("商品加载失败，请检查网络后重试")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (product?: Product) => {
    setSubmitError("")
    setImageError("")
    setImageDataUrl(product ? images[product.id] ?? null : null)
    if (product) {
      setEditingProduct(product)
      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price,
        categoryId: product.categoryId,
        deliveryFormat: product.deliveryFormat || "SINGLE",
        allowResale: product.allowResale,
        resalePrice: product.resalePrice || "",
        resaleMinPrice: product.resaleMinPrice || ""
      })
    } else {
      setEditingProduct(null)
      setFormData({
        name: "",
        description: "",
        price: "",
        categoryId: categories[0]?.id || "",
        deliveryFormat: "SINGLE",
        allowResale: false,
        resalePrice: "",
        resaleMinPrice: ""
      })
    }
    setIsDialogOpen(true)
  }

  const handleOpenDialogRef = useRef(handleOpenDialog)
  useEffect(() => { handleOpenDialogRef.current = handleOpenDialog }, [handleOpenDialog])
  const stableOpenDialog = useCallback((product?: Product) => handleOpenDialogRef.current(product), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError("")

    const name = formData.name.trim()
    const price = formData.price.trim()
    if (!name) {
      setSubmitError("请填写商品名称")
      return
    }
    if (!formData.categoryId) {
      setSubmitError(categories.length ? "请选择商品分类" : "暂无可用分类，请先在分类管理中创建分类")
      return
    }
    if (!price || !Number.isFinite(Number(price)) || Number(price) < 0) {
      setSubmitError("请输入有效的商品价格")
      return
    }

    setSubmitLoading(true)
    const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : "/api/admin/products"
    const method = editingProduct ? "PATCH" : "POST"
    const payload = { ...formData, name, price }

    try {
      const res = await fetch(url, {
        method,
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setSubmitError(data.error || `商品保存失败（HTTP ${res.status}）`)
        return
      }

      // For a brand-new product, capture its id so subsequent saves are PATCH.
      if (!editingProduct && data?.id) {
        setEditingProduct(data)
      }
      const productId = editingProduct ? editingProduct.id : data.id

      // Sync product image (display-only). Failure is non-fatal but surfaced so the
      // user can retry without losing the saved product.
      let imageSyncFailed = false
      if (productId) {
        try {
          if (imageDataUrl) {
            const r = await fetch(`/api/admin/products/${productId}/image`, {
              method: "POST",
              body: JSON.stringify({ image: imageDataUrl }),
              headers: { "Content-Type": "application/json" }
            })
            const d = await r.json().catch(() => ({}))
            if (!r.ok) {
              imageSyncFailed = true
              setImageError(d.error || "图片上传失败")
            } else {
              setImages((prev) => ({ ...prev, [productId]: imageDataUrl }))
            }
          } else if (editingProduct && images[editingProduct.id]) {
            const r = await fetch(`/api/admin/products/${editingProduct.id}/image`, {
              method: "DELETE"
            })
            if (r.ok) {
              setImages((prev) => {
                const next = { ...prev }
                delete next[editingProduct.id]
                return next
              })
            }
          }
        } catch {
          imageSyncFailed = true
          setImageError("图片上传网络错误")
        }
      }

      if (imageSyncFailed) {
        setSubmitLoading(false)
        return
      }

      setIsDialogOpen(false)
      await fetchData()
    } catch (error) {
      console.error(error)
      setSubmitError("网络请求失败，请检查网络后重试")
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleToggleActive = useCallback(async (id: string, current: boolean) => {
    try {
      await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !current }),
        headers: { "Content-Type": "application/json" }
      })
      setProducts(prev => prev.map(p => p.id === id ? { ...p, isActive: !current } : p))
    } catch (error) {
      console.error(error)
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("确定要删除此商品吗？如果有关联的卡密可能会失败。")) return
    
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" })
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id))
      } else {
        const data = await res.json()
        alert(data.error)
      }
    } catch (error) {
      console.error(error)
    }
  }, [])

  const handleImageSelect = async (file: File | undefined) => {
    if (!file) return
    setImageError("")
    try {
      const dataUrl = await compressImage(file)
      setImageDataUrl(dataUrl)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "图片处理失败")
    }
  }

  const removeImage = () => {
    setImageDataUrl(null)
    setImageError("")
  }

  const handleDescriptionChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, description: value }))
  }, [])

  const openStock = useCallback((product: Product) => {
    setStockProduct(product)
    setIsStockOpen(true)
  }, [])

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">商品管理</h1>
          <p className="text-muted-foreground">创建、编辑商品并管理库存</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-[180px]">
             <Select value={selectedCategory} onValueChange={(val) => { setPage(1); setSelectedCategory(val); }}>
               <SelectTrigger>
                 <div className="flex items-center gap-2">
                   <Filter className="h-4 w-4 text-muted-foreground" />
                   <SelectValue placeholder="全部分类" />
                 </div>
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">全部分类</SelectItem>
                 {categories.map(cat => (
                   <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           <Button onClick={() => handleOpenDialog()}>
             <Plus className="mr-2 h-4 w-4" /> 新增商品
           </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card text-white flex-1 flex flex-col overflow-hidden">
        {loadError && (
          <div role="alert" className="m-4 mb-0 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="w-[300px]">名称</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>价格</TableHead>
                <TableHead>库存</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    暂无商品数据
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    image={images[product.id]}
                    onToggle={handleToggleActive}
                    onEdit={stableOpenDialog}
                    onDelete={handleDelete}
                    onStock={openStock}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-end space-x-2 p-4 border-t bg-card shrink-0">
          <div className="flex-1 text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stock Management Dialog */}
      {stockProduct && (
        <StockManager 
          productId={stockProduct.id}
          productName={stockProduct.name}
          open={isStockOpen}
          onOpenChange={setIsStockOpen}
          onStockUpdated={fetchData}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "编辑商品" : "新增商品"}</DialogTitle>
            <DialogDescription>
              配置商品详情与描述信息
            </DialogDescription>
          </DialogHeader>
          
          <form id="product-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
              {/* Left Column: Basic Info */}
              <div className="md:col-span-1 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">商品名称</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="例如：Netflix 4K"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="categoryId">所属分类</Label>
                  <Select 
                    value={formData.categoryId} 
                    onValueChange={(val) => setFormData({ ...formData, categoryId: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product image */}
                <div className="grid gap-2">
                  <Label>商品图片（前台展示）</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                      {imageDataUrl ? (
                        <img src={imageDataUrl} alt="预览" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20">
                        选择图片
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            handleImageSelect(e.target.files?.[0])
                            e.currentTarget.value = ""
                          }}
                        />
                      </label>
                      {imageDataUrl && (
                        <button
                          type="button"
                          onClick={removeImage}
                          className="inline-flex h-8 items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" /> 移除图片
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">建议 1:1 方图，将自动压缩后上传（仅用于商品卡展示）</p>
                  {imageError && (
                    <p className="text-[11px] text-destructive">{imageError}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">价格 (元)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">¥</span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      className="pl-7"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>发货格式</Label>
                  <Select 
                    value={formData.deliveryFormat} 
                    onValueChange={(val) => setFormData({ ...formData, deliveryFormat: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE">普通 (单激活码/IP)</SelectItem>
                      <SelectItem value="ACCOUNT_PASS">账号----密码</SelectItem>
                      <SelectItem value="ACCOUNT_FULL">账号----密码----辅助邮箱----2FA</SelectItem>
                      <SelectItem value="VIRTUAL_CARD">虚拟卡 (卡号|月/年|CVV)</SelectItem>
                      <SelectItem value="PROXY_IP">代理IP (主机:端口:用户:密码)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">影响用户查收卡密时的展示方式</p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.allowResale}
                    onChange={(e) => setFormData({ ...formData, allowResale: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  允许其他商户代销
                </label>

                {formData.allowResale && <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1"><Label className="text-xs">对接价</Label><Input type="number" min="0" step="0.01" value={formData.resalePrice} onChange={(e) => setFormData({ ...formData, resalePrice: e.target.value })} placeholder="A结算价" /></div>
                  <div className="grid gap-1"><Label className="text-xs">对外控价</Label><Input type="number" min="0" step="0.01" value={formData.resaleMinPrice} onChange={(e) => setFormData({ ...formData, resaleMinPrice: e.target.value })} placeholder="B最低售价" /></div>
                </div>}

                <div className="pt-4">
                   <p className="text-xs text-muted-foreground leading-relaxed">
                     提示：<br/>
                     1. 商品创建后默认为上架状态。<br/>
                     2. 请在“库存管理”中添加卡密。<br/>
                     3. 描述支持图片和超链接。<br/>
                     4. 请务必按所选格式添加卡密。
                   </p>
                </div>
              </div>

              {/* Right Column: Rich Text Editor */}
              <div className="md:col-span-2 flex flex-col gap-2 h-full min-h-[400px]">
                <Label>详细描述</Label>
                <div className="flex-1 border rounded-md overflow-hidden bg-background">
                  <MemoRichTextEditor
                    value={formData.description}
                    onChange={handleDescriptionChange}
                    placeholder="输入商品的详细说明，支持图片链接、标题排版..."
                  />
                </div>
              </div>
            </div>
          </form>

          {submitError && (
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button type="submit" form="product-form" disabled={submitLoading}>
              {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLoading ? "保存中..." : "保存商品"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
