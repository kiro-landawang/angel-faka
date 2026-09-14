"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

export interface SidebarCategory {
  id: string
  name: string
  emoji?: string
}

interface SidebarNavProps {
  categories: SidebarCategory[]
  activeId: string
  onSelect: (id: string) => void
}

/**
 * 极简沉浸式侧边分类导航
 * - 固定位置竖直分类列表（非滚轮）
 * - 可折叠：展开显文字、收起仅留图标
 * - 当前选中项用赤陶色高亮
 * - 鼠标靠近分类时按距离平滑放大（二次项衰减），离开还原
 */
export function SidebarNav({ categories, activeId, onSelect }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const RANGE = 120 // 影响半径(px)
  const BOOST = 0.18 // 最大放大比例

  const applyProximity = (my: number) => {
    itemRefs.current.forEach((el) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const cy = r.top + r.height / 2
      const f = Math.max(0, 1 - Math.abs(my - cy) / RANGE)
      const s = 1 + BOOST * f * f
      const dx = 10 * f * f
      el.style.transform = `translateX(${dx}px) scale(${s})`
      el.style.zIndex = String(Math.round(f * 50))
    })
  }
  const reset = () => {
    itemRefs.current.forEach((el) => {
      if (!el) return
      el.style.transform = ""
      el.style.zIndex = ""
    })
  }

  return (
    <aside
      className={cn(
        "shrink-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 backdrop-blur-md transition-[width] duration-300",
        collapsed ? "w-20" : "w-72"
      )}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <span
          className={cn(
            "text-[13px] font-extrabold tracking-[0.15em] text-white/55 transition-opacity",
            collapsed && "pointer-events-none opacity-0"
          )}
        >
          商品分类
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="折叠 / 展开"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[14px] text-white/80 transition hover:bg-[#E2725B]/20"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <div
        ref={listRef}
        onMouseMove={(e) => applyProximity(e.clientY)}
        onMouseLeave={reset}
        className={cn("flex flex-col gap-2.5", collapsed && "items-center")}
      >
        {categories.map((cat, i) => {
          const active = cat.id === activeId
          return (
            <button
              key={cat.id}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              type="button"
              onClick={() => onSelect(cat.id)}
              style={{ transformOrigin: "left center" }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-[14.5px] font-bold text-white/55 will-change-transform",
                "transition-[color,background-color,border-color,box-shadow] duration-200",
                collapsed ? "h-[52px] w-[52px] justify-center gap-0 px-0" : "",
                active
                  ? "border-transparent bg-gradient-to-br from-[#E2725B] to-[#C2553C] text-white shadow-[0_8px_26px_rgba(226,114,91,0.45)]"
                  : "border-white/10 bg-white/5 hover:text-white"
              )}
            >
              {cat.emoji && (
                <span className="text-[19px] leading-none" aria-hidden>
                  {cat.emoji}
                </span>
              )}
              {!collapsed && <span className="whitespace-nowrap">{cat.name}</span>}
            </button>
          )
        })}
      </div>

      <p
        className={cn(
          "mt-3 text-center text-[11.5px] text-white/35 transition-opacity",
          collapsed && "pointer-events-none opacity-0"
        )}
      >
        鼠标靠近分类即放大 · 点击切换
      </p>
    </aside>
  )
}
