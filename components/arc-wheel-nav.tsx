"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"

export interface WheelCategory {
  id: string
  name: string
  emoji?: string
}

interface ArcWheelNavProps {
  categories: WheelCategory[]
  activeId: string
  onSelect: (id: string) => void
  verticalHeight?: number
  horizontalHeight?: number
}

/**
 * 弧形滚轮式侧边导航：
 * - 分类沿弧线（drum）排布，滚动/拖拽时以容器中部为「基准线」对齐。
 * - 越过基准线（最居中）的分类高亮放大，其余按离基准线距离倾斜缩小、降低透明度。
 * - 桌面端为竖向滚轮（左侧边栏），移动端自动切换为横向滚轮（顶部）。
 */
export function ArcWheelNav({
  categories,
  activeId,
  onSelect,
  verticalHeight = 460,
  horizontalHeight = 108,
}: ArcWheelNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const lastIdxRef = useRef<number>(-1)
  const rafRef = useRef<number | null>(null)

  const [isVertical, setIsVertical] = useState(true)

  // 用 ref 持有最新 props，避免 scroll 监听反复重绑
  const catsRef = useRef(categories)
  catsRef.current = categories
  const activeRef = useRef(activeId)
  activeRef.current = activeId
  const onSelRef = useRef(onSelect)
  onSelRef.current = onSelect

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const apply = () => setIsVertical(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // 把某个 item 滚动到容器中心（仅滚动本容器，不联动页面）
  const scrollItemToCenter = useCallback((el: HTMLDivElement, it: HTMLElement, smooth: boolean) => {
    const elRect = el.getBoundingClientRect()
    const itRect = it.getBoundingClientRect()
    const deltaY = itRect.top + itRect.height / 2 - (elRect.top + elRect.height / 2)
    const deltaX = itRect.left + itRect.width / 2 - (elRect.left + elRect.width / 2)
    el.scrollTo({ top: el.scrollTop + deltaY, left: el.scrollLeft + deltaX, behavior: smooth ? "smooth" : "auto" })
  }, [])

  const update = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const horiz = !isVertical
    const mainSize = horiz ? rect.width : rect.height
    const mid = horiz ? rect.left + rect.width / 2 : rect.top + rect.height / 2
    let bestIdx = 0
    let bestDist = Infinity
    const items = itemRefs.current
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it) continue
      const r = it.getBoundingClientRect()
      const itemMid = horiz ? r.left + r.width / 2 : r.top + r.height / 2
      const delta = itemMid - mid
      const norm = mainSize > 0 ? delta / (mainSize / 2) : 0
      const absN = Math.min(1, Math.abs(norm))
      const rotate = -norm * (horiz ? 34 : 44)
      const scale = 1 - absN * 0.3
      const opacity = 1 - absN * 0.55
      const z = -absN * 80
      it.style.transform = `translateZ(${z}px) ${horiz ? `rotateY(${rotate}deg)` : `rotateX(${rotate}deg)`} scale(${scale})`
      it.style.opacity = String(Math.max(0.12, opacity))
      it.style.zIndex = String(100 - Math.round(absN * 100))
      const dist = Math.abs(delta)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }
    if (bestIdx !== lastIdxRef.current) {
      lastIdxRef.current = bestIdx
      const best = catsRef.current[bestIdx]
      if (best && best.id !== activeRef.current) onSelRef.current(best.id)
    }
  }, [isVertical])

  const onScroll = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      update()
    })
  }, [update])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", onScroll, { passive: true })
    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    const id = requestAnimationFrame(() => {
      const idx = catsRef.current.findIndex((c) => c.id === activeRef.current)
      const it = idx >= 0 ? itemRefs.current[idx] : null
      if (it) scrollItemToCenter(el, it, false)
      update()
    })
    return () => {
      el.removeEventListener("scroll", onScroll)
      ro.disconnect()
      cancelAnimationFrame(id)
    }
  }, [onScroll, update, categories.length])

  const handleClick = (i: number) => {
    const el = scrollRef.current
    const it = itemRefs.current[i]
    if (el && it) scrollItemToCenter(el, it, true)
  }

  const height = isVertical ? verticalHeight : horizontalHeight
  const itemH = 56
  const spacer = Math.max(0, (height - itemH) / 2)

  return (
    <div
      ref={scrollRef}
      className={cn(
        "relative w-full overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        isVertical ? "overflow-y-auto" : "overflow-x-auto"
      )}
      style={{
        height,
        perspective: "1000px",
        scrollSnapType: isVertical ? "y mandatory" : "x mandatory",
      }}
    >
      {/* 基准线指示 */}
      <div
        className={cn(
          "pointer-events-none absolute z-20",
          isVertical
            ? "left-2 right-2 top-1/2 h-[2px] -translate-y-1/2"
            : "top-2 bottom-2 left-1/2 w-[2px] -translate-x-1/2"
        )}
        style={{
          background: "linear-gradient(90deg, transparent, rgba(214,106,139,0.9), transparent)",
          boxShadow: "0 0 12px rgba(214,106,139,0.7)",
        }}
      />
      <div
        className={cn("flex", isVertical ? "flex-col items-center" : "flex-row items-center")}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div style={isVertical ? { height: spacer } : { width: spacer }} />
        {categories.map((cat, i) => {
          const active = cat.id === activeId
          return (
            <button
              key={cat.id}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              type="button"
              onClick={() => handleClick(i)}
              className={cn(
                "flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-3 text-sm font-medium transition-colors duration-200 will-change-transform",
                isVertical ? "my-1" : "mx-1",
                active
                  ? "bg-gradient-to-r from-[#ff5fa2] via-[#ff8a3d] via-[#facc15] via-[#4ade80] via-[#3b82f6] to-[#a855f7] text-white shadow-[0_6px_18px_rgba(214,106,139,0.45)]"
                  : "bg-white/70 text-muted-foreground hover:text-foreground"
              )}
              style={{ height: itemH, scrollSnapAlign: "center", scrollSnapStop: "always" }}
            >
              {cat.emoji && <span aria-hidden>{cat.emoji}</span>}
              <span>{cat.name}</span>
            </button>
          )
        })}
        <div style={isVertical ? { height: spacer } : { width: spacer }} />
      </div>
    </div>
  )
}
