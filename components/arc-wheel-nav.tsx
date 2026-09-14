"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  arcHeight?: number
  drumHeight?: number
}

const ARC_RADIUS = 430
const ARC_ITEM_W = 132
const ARC_ITEM_H = 52
const ARC_STEP = 0.18 // rad ≈ 10.3°，相邻分类沿圆弧的间隔
const ARC_MAX_ANGLE = 1.15 // rad，超过此角度彻底淡出
const CENTER_ANGLE = Math.PI // 圆的最左端点（即基准线所在位置）

function normalizeDiff(diff: number) {
  return ((diff + Math.PI) % (Math.PI * 2)) - Math.PI
}

/**
 * 弧形滚轮式分类导航
 * - 桌面端（≥md）：真正的圆弧导航。圆心在侧边栏右侧外部，分类沿左半圆弧排布；
 *   最右端有一条垂直发光基准线，分类到达基准线时高亮，远离时旋转、淡出、模糊。
 * - 移动端（<md）：顶部横向滚轮，snap 到中心基准线，同样「到达基准线才高亮」。
 */
export function ArcWheelNav({
  categories,
  activeId,
  onSelect,
  arcHeight = 480,
  drumHeight = 108,
}: ArcWheelNavProps) {
  const arcRef = useRef<HTMLDivElement>(null)
  const drumRef = useRef<HTMLDivElement>(null)

  const [isDesktop, setIsDesktop] = useState(false)
  const [dims, setDims] = useState({ w: 180, h: arcHeight })

  // 圆弧模式：当前旋转角度（rad）
  const [rotation, setRotation] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef({ y: 0, rotation: 0 })

  // refs 给事件回调避免重绑
  const catsRef = useRef(categories)
  catsRef.current = categories
  const activeRef = useRef(activeId)
  activeRef.current = activeId
  const onSelRef = useRef(onSelect)
  onSelRef.current = onSelect

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const apply = () => setIsDesktop(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // 监听容器尺寸
  useEffect(() => {
    const el = arcRef.current
    if (!el || !isDesktop) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      setDims({ w: cr.width, h: cr.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isDesktop])

  // 当外部 activeId 变化（或初始化）时，把对应分类转到基准线
  useEffect(() => {
    if (!isDesktop) return
    const idx = categories.findIndex((c) => c.id === activeId)
    if (idx >= 0) setRotation(-idx * ARC_STEP)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, isDesktop])

  // 圆弧模式：计算当前最靠近基准线的分类索引
  const activeIndex = useMemo(() => {
    if (!isDesktop) return -1
    let best = 0
    let bestDiff = Infinity
    categories.forEach((_, i) => {
      const angle = CENTER_ANGLE + i * ARC_STEP + rotation
      const diff = Math.abs(normalizeDiff(angle - CENTER_ANGLE))
      if (diff < bestDiff) {
        bestDiff = diff
        best = i
      }
    })
    return best
  }, [categories, isDesktop, rotation])

  useEffect(() => {
    if (!isDesktop) return
    const cat = categories[activeIndex]
    if (cat && cat.id !== activeRef.current) onSelRef.current(cat.id)
  }, [activeIndex, categories, isDesktop])

  // 圆弧模式：滚轮 / 拖拽
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setRotation((r) => r - e.deltaY * 0.0025)
  }
  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true)
    dragStartRef.current = { y: e.clientY, rotation }
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const dy = e.clientY - dragStartRef.current.y
    setRotation(dragStartRef.current.rotation - dy * 0.006)
  }
  const handlePointerUp = () => setDragging(false)
  const snapToIndex = (i: number) => setRotation(-i * ARC_STEP)

  // ---------------- drum（移动端） ----------------
  const drumItemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const drumRafRef = useRef<number | null>(null)
  const drumLastIdxRef = useRef<number>(-1)

  const updateDrum = () => {
    const el = drumRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mid = rect.left + rect.width / 2
    let bestIdx = 0
    let bestDist = Infinity
    drumItemRefs.current.forEach((it, i) => {
      if (!it) return
      const r = it.getBoundingClientRect()
      const itemMid = r.left + r.width / 2
      const delta = itemMid - mid
      const norm = rect.width > 0 ? delta / (rect.width / 2) : 0
      const absN = Math.min(1, Math.abs(norm))
      const rotateY = -norm * 34
      const scale = 1 - absN * 0.3
      const opacity = 1 - absN * 0.55
      const z = -absN * 80
      it.style.transform = `translateZ(${z}px) rotateY(${rotateY}deg) scale(${scale})`
      it.style.opacity = String(Math.max(0.12, opacity))
      it.style.zIndex = String(100 - Math.round(absN * 100))
      const dist = Math.abs(delta)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    })
    if (bestIdx !== drumLastIdxRef.current) {
      drumLastIdxRef.current = bestIdx
      const best = catsRef.current[bestIdx]
      if (best && best.id !== activeRef.current) onSelRef.current(best.id)
    }
  }

  const onDrumScroll = () => {
    if (drumRafRef.current != null) return
    drumRafRef.current = requestAnimationFrame(() => {
      drumRafRef.current = null
      updateDrum()
    })
  }

  useEffect(() => {
    if (isDesktop) return
    const el = drumRef.current
    if (!el) return
    el.addEventListener("scroll", onDrumScroll, { passive: true })
    const ro = new ResizeObserver(() => updateDrum())
    ro.observe(el)
    const id = requestAnimationFrame(() => {
      const idx = catsRef.current.findIndex((c) => c.id === activeRef.current)
      const it = idx >= 0 ? drumItemRefs.current[idx] : null
      if (it) {
        const elRect = el.getBoundingClientRect()
        const itRect = it.getBoundingClientRect()
        const deltaX = itRect.left + itRect.width / 2 - (elRect.left + elRect.width / 2)
        el.scrollLeft += deltaX
      }
      updateDrum()
    })
    return () => {
      el.removeEventListener("scroll", onDrumScroll)
      ro.disconnect()
      cancelAnimationFrame(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop])

  const drumScrollToCenter = (i: number) => {
    const el = drumRef.current
    const it = drumItemRefs.current[i]
    if (!el || !it) return
    const elRect = el.getBoundingClientRect()
    const itRect = it.getBoundingClientRect()
    const deltaX = itRect.left + itRect.width / 2 - (elRect.left + elRect.width / 2)
    el.scrollTo({ left: el.scrollLeft + deltaX, behavior: "smooth" })
  }

  if (categories.length === 0) return null

  // ---------------- 桌面：圆弧 ----------------
  if (isDesktop) {
    // 圆心在侧边栏右侧外部；激活项（角度 π）的中心正好对齐右侧基准线
    const centerX = dims.w - ARC_ITEM_W / 2 + ARC_RADIUS
    const centerY = dims.h / 2
    return (
      <div
        ref={arcRef}
        className="relative select-none overflow-hidden"
        style={{ height: arcHeight, touchAction: "none" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* 垂直基准线（右侧发光） */}
        <div
          className="pointer-events-none absolute top-1/2 z-20 w-[2px] -translate-y-1/2"
          style={{
            right: ARC_ITEM_W / 2,
            height: `${Math.min(arcHeight, 260)}px`,
            background: "linear-gradient(180deg, transparent, rgba(214,106,139,0.95), transparent)",
            boxShadow: "0 0 14px rgba(214,106,139,0.75)",
          }}
        />
        {categories.map((cat, i) => {
          const angle = CENTER_ANGLE + i * ARC_STEP + rotation
          const diff = normalizeDiff(angle - CENTER_ANGLE)
          const absDiff = Math.abs(diff)
          const x = centerX + ARC_RADIUS * Math.cos(angle) - ARC_ITEM_W / 2
          const y = centerY + ARC_RADIUS * Math.sin(angle) - ARC_ITEM_H / 2
          const scale = 1 - Math.min(1, absDiff / ARC_MAX_ANGLE) * 0.38
          const opacity = 1 - Math.min(1, absDiff / ARC_MAX_ANGLE) * 0.72
          const blur = Math.min(1, absDiff / ARC_MAX_ANGLE) * 3.2
          const rotate = (diff * 180) / Math.PI
          const active = i === activeIndex
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => snapToIndex(i)}
              className={cn(
                "absolute flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200",
                active
                  ? "bg-gradient-to-r from-[#ff5fa2] via-[#ff8a3d] via-[#facc15] via-[#4ade80] via-[#3b82f6] to-[#a855f7] text-white shadow-[0_6px_20px_rgba(214,106,139,0.5)]"
                  : "bg-white/70 text-muted-foreground hover:text-foreground"
              )}
              style={{
                left: x,
                top: y,
                width: ARC_ITEM_W,
                height: ARC_ITEM_H,
                transform: `rotate(${rotate}deg) scale(${scale})`,
                opacity,
                filter: `blur(${blur}px)`,
                pointerEvents: opacity < 0.12 ? "none" : "auto",
                zIndex: 100 - Math.round(absDiff * 60),
              }}
            >
              {cat.emoji && <span aria-hidden>{cat.emoji}</span>}
              <span>{cat.name}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // ---------------- 移动端：横向滚轮 ----------------
  const drumSpacer = Math.max(0, (drumHeight - 56) / 2)
  return (
    <div
      ref={drumRef}
      className="relative w-full overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ height: drumHeight, perspective: "1000px", scrollSnapType: "x mandatory" }}
    >
      {/* 横向基准线（中部发光） */}
      <div
        className="pointer-events-none absolute left-1/2 top-2 bottom-2 z-20 w-[2px] -translate-x-1/2"
        style={{
          background: "linear-gradient(180deg, transparent, rgba(214,106,139,0.9), transparent)",
          boxShadow: "0 0 12px rgba(214,106,139,0.7)",
        }}
      />
      <div className="flex flex-row items-center" style={{ transformStyle: "preserve-3d" }}>
        <div style={{ width: drumSpacer }} />
        {categories.map((cat, i) => {
          const active = cat.id === activeId
          return (
            <button
              key={cat.id}
              ref={(el) => {
                drumItemRefs.current[i] = el
              }}
              type="button"
              onClick={() => drumScrollToCenter(i)}
              className={cn(
                "flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-3 text-sm font-medium transition-colors duration-200 will-change-transform",
                "mx-1",
                active
                  ? "bg-gradient-to-r from-[#ff5fa2] via-[#ff8a3d] via-[#facc15] via-[#4ade80] via-[#3b82f6] to-[#a855f7] text-white shadow-[0_6px_18px_rgba(214,106,139,0.45)]"
                  : "bg-white/70 text-muted-foreground hover:text-foreground"
              )}
              style={{ height: 56, scrollSnapAlign: "center", scrollSnapStop: "always" }}
            >
              {cat.emoji && <span aria-hidden>{cat.emoji}</span>}
              <span>{cat.name}</span>
            </button>
          )
        })}
        <div style={{ width: drumSpacer }} />
      </div>
    </div>
  )
}
