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
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-medium tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff7eb3] to-[#ec4a8c] text-sm shadow-sm">
            🌸
          </span>
          <span className="bg-gradient-to-r from-[#ff5fa2] to-[#ec3c86] bg-clip-text text-transparent">
            Angel
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-[13px] text-muted-foreground">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors hover:text-foreground",
                pathname === link.href && "font-medium text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <OrderLookup />
          <a
            href="https://iacg.love/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center rounded-full bg-gradient-to-r from-[#ff5fa2] via-[#ff8a3d] via-[#facc15] via-[#4ade80] via-[#3b82f6] to-[#a855f7] px-3.5 py-1.5 text-[13px] font-medium text-white shadow-sm transition-transform duration-200 hover:scale-[1.03] active:scale-95"
          >
            神秘福利
          </a>
        </nav>
      </div>
    </header>
  )
}
