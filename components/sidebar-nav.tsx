"use client"

import { useState } from "react"
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
 * 分类导航（暗玻璃）
 * - 桌面端：固定竖直分类列表，可折叠（展开显文字 / 收起仅图标），当前项赤陶色高亮
 * - 桌面端：鼠标靠近分类时邻近放大 —— 纯 CSS 实现（:hover + :has(+ :hover)），
 *   见 app/globals.css 的 .nav-item 规则
 * - 移动端（<md）：整条变为全宽横向滚动分类条，折叠按钮隐藏
 *
 * 性能说明（别再改回 JS 版）：
 * 旧实现每次 mousemove 都跑 rAF，并在回调里对每个分类调用
 * getBoundingClientRect() 再写 transform/zIndex。读-写混排会让浏览器每帧
 * 强制同步布局 N 次（N = 分类数），鼠标一移就掉帧。
 * 现在放大效果交给 CSS（合成器线程处理 transform，不触发布局），
 * 组件本身只有折叠状态一个 useState，移动鼠标时 JS 完全不参与。
 */
export function SidebarNav({ categories, activeId, onSelect }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        // 暗玻璃：细描边 + 半透明底，无 backdrop-blur（背后是纯色底，模糊无视觉收益）
        "w-full rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-4",
        "transition-[width] duration-300 md:shrink-0",
        collapsed ? "md:w-24" : "md:w-60",
        "max-md:rounded-2xl"
      )}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <span
          className={cn(
            "text-[11.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-opacity",
            collapsed && "pointer-events-none opacity-0"
          )}
        >
          商品分类
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="折叠 / 展开"
          className="ml-auto hidden h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[14px] text-zinc-400 transition-colors hover:border-white/20 hover:text-primary md:flex"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {/* 移动端：横向滚动分类条；桌面端：竖直列表 */}
      <div
        className={cn(
          "nav-list flex gap-2.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0",
          collapsed && "md:items-center"
        )}
      >
        {categories.map((cat) => {
          const active = cat.id === activeId
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={cn(
                "nav-item flex shrink-0 items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[14.5px] font-semibold text-zinc-400",
                collapsed ? "md:h-[52px] md:w-[52px] md:justify-center md:gap-0 md:px-0" : "",
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-white/[0.07] bg-white/[0.04] hover:border-white/20 hover:text-zinc-100"
              )}
            >
              {cat.emoji && (
                <span className="text-[17px] leading-none" aria-hidden>
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
          "mt-3 text-center text-[11.5px] text-zinc-600 transition-opacity max-md:hidden",
          collapsed && "pointer-events-none opacity-0"
        )}
      >
        鼠标靠近分类即放大 · 点击切换
      </p>
    </aside>
  )
}
