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
        <Link href="/" className="text-[15px] font-medium tracking-tight">
          Angel
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
        </nav>
      </div>
    </header>
  )
}
