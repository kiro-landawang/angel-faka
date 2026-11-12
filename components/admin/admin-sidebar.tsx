"use client"

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
  Users,
  Layers,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** 角标计数键：由布局传入（如待支付订单数） */
  badge?: number
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "总览",
    items: [{ href: "/admin", label: "仪表盘", icon: LayoutDashboard }],
  },
  {
    title: "商品",
    items: [
      { href: "/admin/products", label: "商品管理", icon: ShoppingBag },
      { href: "/admin/categories", label: "分类管理", icon: Layers },
      { href: "/admin/merchants", label: "商户管理", icon: Package },
    ],
  },
  {
    title: "交易",
    items: [
      { href: "/admin/orders", label: "订单列表", icon: FileText },
      { href: "/admin/coupons", label: "优惠码管理", icon: Ticket },
    ],
  },
  {
    title: "用户与内容",
    items: [
      { href: "/admin/customers", label: "用户 / 积分", icon: Users },
      { href: "/admin/articles", label: "文章管理", icon: BookOpen },
    ],
  },
  {
    title: "系统",
    items: [{ href: "/admin/settings", label: "系统设置", icon: Settings }],
  },
]

export function useAdminActive(pathname: string) {
  return (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
}

/** 品牌区（桌面侧栏 / 移动端抽屉共用） */
export function AdminBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        A
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold text-foreground">ANGEL 发卡</div>
        <div className="text-[10px] tracking-[0.12em] text-muted-foreground">
          ADMIN CONSOLE
        </div>
      </div>
    </div>
  )
}

/** 分组菜单列表（桌面侧栏 / 移动端抽屉共用） */
export function AdminNavList({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname()
  const isActive = useAdminActive(pathname)

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="select-none px-2 pb-1.5 pt-4 text-[11px] tracking-wider text-muted-foreground/70">
            {group.title}
          </div>
          {group.items.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            const badge =
              item.href === "/admin/orders" && pendingCount > 0 ? pendingCount : undefined
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-menu-item ${active ? "active" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {item.label}
                {badge !== undefined && (
                  <span className="ml-auto rounded-full bg-primary px-[7px] py-px text-[11px] font-semibold leading-4 text-primary-foreground">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

/** 桌面端侧边栏整体（含品牌区、菜单、底部用户块） */
export function AdminSidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
      <div className="px-4 pb-3 pt-5">
        <AdminBrand />
      </div>
      <AdminNavList pendingCount={pendingCount} />
      <div className="flex items-center gap-2.5 border-t p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
          皮
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-foreground">皮蛋</div>
          <div className="text-[11px] text-muted-foreground">超级管理员</div>
        </div>
        <a
          href="/api/admin/logout"
          aria-label="退出登录"
          title="退出登录"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </a>
      </div>
    </aside>
  )
}
