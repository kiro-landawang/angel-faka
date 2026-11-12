"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Search, Bell } from "lucide-react"
import { NAV_GROUPS } from "@/components/admin/admin-sidebar"

/** 根据当前路径算出「后台 / xxx」面包屑 */
function useCrumb(pathname: string) {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const active =
        item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
      if (active) return item.label
    }
  }
  return ""
}

/**
 * 后台顶栏：面包屑 + 订单搜索（回车跳订单页）+ 待处理通知入口。
 * 搜索走 URL 参数 ?search=，订单页挂载时会读取并同步到自己的搜索框。
 */
export function AdminTopbar({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname()
  const crumb = useCrumb(pathname)
  const [keyword, setKeyword] = useState("")

  return (
    <header className="hidden h-14 shrink-0 items-center gap-3 border-b bg-card px-6 md:flex">
      <div className="min-w-0 text-[13px] text-muted-foreground">
        后台 / <span className="font-semibold text-foreground">{crumb || "仪表盘"}</span>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <form
          className="hidden items-center gap-2 rounded-md border bg-background px-3 py-1.5 md:flex"
          onSubmit={(e) => {
            e.preventDefault()
            const q = keyword.trim()
            window.location.href = q
              ? `/admin/orders?search=${encodeURIComponent(q)}`
              : "/admin/orders"
          }}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索订单号 / 邮箱"
            className="w-40 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70 lg:w-52"
          />
        </form>
        <Link
          href="/admin/orders"
          aria-label="待处理订单"
          title={pendingCount > 0 ? `${pendingCount} 笔待支付订单` : "订单列表"}
          className="relative flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {pendingCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-card" />
          )}
        </Link>
      </div>
    </header>
  )
}
