"use client"

import { useEffect, useRef } from "react"

// 左右看板娘：AI 生成的二次元角色（透明背景 WebP，public/mascot-*.webp）。
// 鼠标跟随：轻微侧倾 + 平移朝向光标（rAF 节流，transform-only）
// 全部走合成层，不触发布局/重绘；移动端隐藏；respect prefers-reduced-motion。
// 注：静态图片没法真动眼球，用整体"侧倾看向光标"来模拟盯着鼠标的感觉。
// 已关闭待机浮动动画，避免持续重绘造成页面整体卡顿。
export function Mascot() {
  const leftTilt = useRef<HTMLDivElement>(null)
  const rightTilt = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        for (const el of [leftTilt.current, rightTilt.current]) {
          if (!el) continue
          const r = el.getBoundingClientRect()
          const dx = e.clientX - (r.left + r.width / 2)
          const rot = Math.max(-4, Math.min(4, dx / 70))
          const tx = Math.max(-8, Math.min(8, dx / 45))
          el.style.transform = `rotate(${rot.toFixed(2)}deg) translateX(${tx.toFixed(1)}px)`
        }
      })
    }
    window.addEventListener("mousemove", onMove, { passive: true })
    return () => {
      window.removeEventListener("mousemove", onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {/* 左：黑发 */}
      <div
        ref={leftTilt}
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 z-30 hidden select-none will-change-transform sm:block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot-left.webp"
          alt=""
          width={800}
          height={1200}
          className="block h-auto w-[150px] drop-shadow-[0_10px_24px_rgba(214,106,139,0.35)] lg:w-[170px]"
        />
      </div>

      {/* 右：紫发（水平镜像，朝向页面内侧） */}
      <div
        ref={rightTilt}
        aria-hidden
        className="pointer-events-none fixed bottom-0 right-0 z-30 hidden select-none will-change-transform sm:block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot-right.webp"
          alt=""
          width={798}
          height={1200}
          className="block h-auto w-[150px] -scale-x-100 drop-shadow-[0_10px_24px_rgba(150,80,190,0.3)] lg:w-[170px]"
        />
      </div>
    </>
  )
}
