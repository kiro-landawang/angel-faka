"use client"

import { useState } from "react"
import { Menu, X, LogOut } from "lucide-react"
import { AdminBrand, AdminNavList } from "@/components/admin/admin-sidebar"

export function AdminMobileNav({ pendingCount = 0 }: { pendingCount?: number }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar (only shows below md) */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 md:hidden">
        <AdminBrand />
        <button
          type="button"
          aria-label="打开菜单"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col border-r bg-card">
            <div className="flex items-center justify-between px-4 pb-3 pt-5">
              <AdminBrand />
              <button
                type="button"
                aria-label="关闭菜单"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div onClickCapture={() => setOpen(false)}>
              <AdminNavList pendingCount={pendingCount} />
            </div>
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
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
