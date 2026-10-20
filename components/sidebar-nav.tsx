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
 * 白底液态玻璃分类导航
 * - 桌面端：固定竖直分类列表，可折叠（展开显文字 / 收起仅图标），当前项赤陶色高亮
 * - 桌面端：鼠标靠近分类时按距离平滑放大（二次项衰减），rAF 节流，离开还原
 * - 移动端（<md）：整条变为全宽横向滚动分类条，折叠按钮隐藏
 */
export function SidebarNav({ categories, activeId, onSelect }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const latestY = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const RANGE = 130 // 影响半径(px)
  const BOOST = 0.16 // 最大放大比例

  const applyFrame = () => {
    rafRef.current = null
    const my = latestY.current
    if (my == null) return
    // 仅桌面端做邻近放大（移动端为横向滚动，按 Y 计算无意义）
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches) return
    itemRefs.current.forEach((el) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const cy = r.top + r.height / 2
      const f = Math.max(0, 1 - Math.abs(my - cy) / RANGE)
      const s = 1 + BOOST * f * f
      const dx = 12 * f * f
      el.style.transform = `translateX(${dx}px) scale(${s})`
      el.style.zIndex = f > 0.05 ? String(Math.round(f * 50)) : ""
    })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    latestY.current = e.clientY
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(applyFrame)
    }
  }

  const reset = () => {
    latestY.current = null
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    itemRefs.current.forEach((el) => {
      if (!el) return
      el.style.transform = ""
      el.style.zIndex = ""
    })
  }

  return (
    <aside
      className={cn(
        // 白底液态玻璃：半透明 + 背景折射 + 浅色描边
        "w-full rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_8px_30px_rgba(22,22,40,0.07)] backdrop-blur-md",
        "transition-[width] duration-300 md:shrink-0",
        collapsed ? "md:w-24" : "md:w-72",
        "max-md:rounded-2xl"
      )}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <span
          className={cn(
            "text-[13px] font-extrabold tracking-[0.15em] text-zinc-400 transition-opacity",
            collapsed && "pointer-events-none opacity-0"
          )}
        >
          商品分类
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="折叠 / 展开"
          className="ml-auto hidden h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white/70 text-[14px] text-zinc-500 transition hover:bg-[#E2725B]/15 hover:text-[#E2725B] md:flex"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {/* 移动端：横向滚动分类条；桌面端：竖直列表 */}
      <div
        onMouseMove={onMouseMove}
        onMouseLeave={reset}
        className={cn(
          "flex gap-2.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0",
          collapsed && "md:items-center"
        )}
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
                "flex shrink-0 items-center gap-2.5 rounded-xl border px-4 py-3 text-[14.5px] font-bold text-zinc-500 will-change-transform",
                "transition-[color,background-color,border-color,box-shadow,transform] duration-200",
                collapsed ? "md:h-[52px] md:w-[52px] md:justify-center md:gap-0 md:px-0" : "",
                active
                  ? "border-transparent bg-gradient-to-br from-[#E2725B] to-[#C2553C] text-white shadow-[0_8px_26px_rgba(226,114,91,0.45)]"
                  : "border-zinc-200 bg-white/60 hover:border-[#E2725B]/40 hover:text-zinc-900"
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
          "mt-3 text-center text-[11.5px] text-zinc-400 transition-opacity max-md:hidden",
          collapsed && "pointer-events-none opacity-0"
        )}
      >
        鼠标靠近分类即放大 · 点击切换
      </p>
    </aside>
  )
}
