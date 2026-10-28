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
    { href: "/", label: "商店" },
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
    <header className="sticky top-0 z-50 w-full px-4 pt-3 sm:px-6">
      <div className="mx-auto flex h-[54px] max-w-7xl items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 shadow-[0_2px_16px_rgba(15,23,42,0.06)] sm:px-5">
        <Link href="/" className="flex items-center gap-2 text-[15.5px] font-bold tracking-tight text-foreground">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-primary text-[13px] font-extrabold text-primary-foreground">
            A
          </span>
          <span className="hidden sm:inline">ANGEL 旗舰</span>
        </Link>
        <nav className="ml-1 flex items-center gap-1 text-[14px]">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                pathname === link.href && "bg-secondary font-medium text-primary"
              )}
            >
              <span className="inline-flex items-center gap-1">
                {link.href === "/lottery" && <Gift className="h-3.5 w-3.5" />}
                {link.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <OrderLookup />
          {checking ? null : account ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/lottery"
                className="hidden items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex"
              >
                <Coins className="h-3.5 w-3.5 text-primary" />
                {account.points} 积分
              </Link>
              <button
                onClick={handleLogout}
                title="退出登录"
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <User className="h-3.5 w-3.5" />
              登录
            </Link>
          )}
          <a
            href="https://gobang-6e6.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center whitespace-nowrap rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            五子棋入口
          </a>
          <a
            href="https://iacg.love/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 hidden items-center whitespace-nowrap rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex"
          >
            神秘福利
          </a>
          <a
            href="https://yehang.web.zaka.live/home.html"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 hidden items-center whitespace-nowrap rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex"
          >
            神秘福利2
          </a>
        </div>
      </div>
    </header>
  )
}
