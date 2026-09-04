"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FileText,
  Settings,
  LogOut,
  BookOpen,
  Ticket,
  Radio,
  Menu,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/admin", label: "仪表盘", icon: LayoutDashboard },
  { href: "/admin/merchants", label: "商户管理", icon: Package },
  { href: "/admin/products", label: "商品管理", icon: ShoppingBag },
  { href: "/admin/categories", label: "分类管理", icon: Package },
  { href: "/admin/orders", label: "订单列表", icon: FileText },
  { href: "/admin/payments", label: "收款监控", icon: Radio },
  { href: "/admin/coupons", label: "优惠码管理", icon: Ticket },
  { href: "/admin/articles", label: "文章管理", icon: BookOpen },
  { href: "/admin/settings", label: "系统设置", icon: Settings },
]

export function AdminMobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Mobile top bar (only shows below md) */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 md:hidden">
        <span className="font-bold text-lg">GeekFaka</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="打开菜单"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col border-r bg-background p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-bold text-lg">GeekFaka Admin</span>
              <Button variant="ghost" size="icon" aria-label="关闭菜单" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start",
                        active && "bg-accent text-accent-foreground"
                      )}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                )
              })}
            </nav>
            <div className="border-t pt-3">
              <a href="/api/admin/logout" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full justify-start">
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
