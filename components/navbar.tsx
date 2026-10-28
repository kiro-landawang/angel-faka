"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { OrderLookup } from "@/components/order-lookup"
import { cn } from "@/lib/utils"
import { Gift, Coins, LogOut, User, Menu, X } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const links = [
    { href: "/", label: "首页" },
    { href: "/pages", label: "帮助" },
    { href: "/lottery", label: "抽奖" },
  ]

  const [account, setAccount] = useState<{ email: string; points: number; drawsAvailable: number } | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    fetch("/api/customer/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d) setAccount(d) })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [])

  // 路由变化时自动收起移动端菜单
  useEffect(() => { setOpen(false) }, [pathname])

  const handleLogout = async () => {
    await fetch("/api/customer/logout", { method: "POST" })
    setAccount(null)
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="text-[18px] font-extrabold tracking-tight text-gray-900 sm:hidden">ANGEL</span>
          <span className="hidden text-[20px] font-extrabold tracking-tight text-gray-900 sm:inline">ANGEL 旗舰店</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded px-3 py-2 text-[14px] transition-colors",
                pathname === link.href
                  ? "font-medium text-primary"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <span className="inline-flex items-center gap-1">
                {link.href === "/lottery" && <Gift className="h-3.5 w-3.5" />}
                {link.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <OrderLookup />
          </div>
          {checking ? null : account ? (
            <div className="flex items-center gap-2">
              <Link
                href="/lottery"
                className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-700 transition-colors hover:border-primary hover:text-primary sm:gap-1.5 sm:px-3 sm:text-[13px]"
              >
                <Coins className="h-3.5 w-3.5 text-primary" />
                {account.points} 积分
              </Link>
              <button
                onClick={handleLogout}
                title="退出登录"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 transition-colors hover:border-primary hover:text-primary sm:h-[34px] sm:w-[34px]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:px-4"
            >
              <User className="h-3.5 w-3.5" />
              登录
            </Link>
          )}

          {/* 移动端汉堡菜单 */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="打开菜单"
            aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-200 text-gray-700 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* 移动端下拉导航 */}
      {open && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded px-3 py-2.5 text-[15px] transition-colors",
                  pathname === link.href
                    ? "bg-primary/5 font-medium text-primary"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                {link.href === "/lottery" && <Gift className="h-4 w-4" />}
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-2 border-t border-gray-100 pt-3 sm:hidden">
            <OrderLookup />
          </div>
        </div>
      )}
    </header>
  )
}
