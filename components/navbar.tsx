"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { OrderLookup } from "@/components/order-lookup"
import { cn } from "@/lib/utils"

export function Navbar() {
  const pathname = usePathname()
  const links = [
    { href: "/", label: "商店" },
    { href: "/pages", label: "帮助" },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90">
      <div className="mx-auto flex h-[62px] max-w-7xl items-center gap-8 px-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-[16px] font-bold tracking-tight text-foreground">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-gradient-to-br from-[#E2725B] to-[#C2553C] text-[13px] font-extrabold text-white">
            A
          </span>
          ANGEL 旗舰
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-[14px]">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground",
                pathname === link.href && "font-medium text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <OrderLookup />
          <a
            href="https://gobang-6e6.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-[#E2725B] to-[#C2553C] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[0_8px_26px_rgba(226,114,91,0.32)] transition-transform hover:scale-[1.03]"
          >
            五子棋入口
          </a>
          <a
            href="https://iacg.love/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            神秘福利
          </a>
          <a
            href="https://yehang.web.zaka.live/home.html"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            神秘福利2
          </a>
        </nav>
      </div>
    </header>
  )
}
