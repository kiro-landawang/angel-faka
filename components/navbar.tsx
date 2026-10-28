"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { OrderLookup } from "@/components/order-lookup"
import { cn } from "@/lib/utils"
import { Gift, Coins, LogOut, User } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
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

  const handleLogout = async () => {
    await fetch("/api/customer/logout", { method: "POST" })
    setAccount(null)
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[20px] font-extrabold tracking-tight text-gray-900">ANGEL 旗舰店</span>
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

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:block">
            <OrderLookup />
          </div>
          {checking ? null : account ? (
            <div className="flex items-center gap-2">
              <Link
                href="/lottery"
                className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-gray-700 transition-colors hover:border-primary hover:text-primary"
              >
                <Coins className="h-3.5 w-3.5 text-primary" />
                {account.points} 积分
              </Link>
              <button
                onClick={handleLogout}
                title="退出登录"
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded border border-gray-200 text-gray-600 transition-colors hover:border-primary hover:text-primary"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <User className="h-3.5 w-3.5" />
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
