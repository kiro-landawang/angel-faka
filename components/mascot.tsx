"use client"

import { useEffect, useRef } from "react"

// 左侧看板娘：SVG 动漫女角色，眼睛瞳孔 + 头部跟随鼠标。
// 纯矢量绘制，无需任何图片资源；fixed 定位、pointer-events-none 不挡点击。
export function Mascot() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<SVGGElement>(null)
  const leftPupil = useRef<SVGGElement>(null)
  const rightPupil = useRef<SVGGElement>(null)

  useEffect(() => {
    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const wrap = wrapRef.current
        if (!wrap) return
        const r = wrap.getBoundingClientRect()
        // 角色"眼睛"大致在容器内 42% 高度处
        const cx = r.left + r.width / 2
        const cy = r.top + r.height * 0.42
        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const ang = Math.atan2(dy, dx)
        const max = 4.5 // 瞳孔最大偏移
        const px = Math.cos(ang) * max
        const py = Math.sin(ang) * max
        leftPupil.current?.setAttribute("transform", `translate(${px.toFixed(2)} ${py.toFixed(2)})`)
        rightPupil.current?.setAttribute("transform", `translate(${px.toFixed(2)} ${py.toFixed(2)})`)
        // 头部轻微转向鼠标（鼠标在左 -> 头向左偏）
        const tilt = Math.max(-7, Math.min(7, dx / 38))
        headRef.current?.setAttribute("transform", `rotate(${tilt.toFixed(2)} 100 188)`)
      })
    }
    window.addEventListener("mousemove", onMove)
    return () => {
      window.removeEventListener("mousemove", onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none fixed bottom-0 left-0 z-30 hidden select-none sm:block"
      style={{ width: 150, height: 230 }}
    >
      <svg viewBox="0 0 200 320" width="100%" height="100%" className="drop-shadow-[0_8px_20px_rgba(214,106,139,0.35)]">
        <defs>
          <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffc2dd" />
            <stop offset="100%" stopColor="#ff8fb8" />
          </linearGradient>
          <linearGradient id="dress" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe0ee" />
            <stop offset="100%" stopColor="#ff9ec4" />
          </linearGradient>
          <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff9ec1" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ff9ec1" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 身体 / 裙子 */}
        <path d="M70 200 Q100 188 130 200 L150 300 Q100 318 50 300 Z" fill="url(#dress)" />
        <path d="M100 196 L100 300" stroke="#ff8fb8" strokeWidth="1.5" opacity="0.5" />
        {/* 领口 */}
        <path d="M82 198 Q100 210 118 198" fill="none" stroke="#ff7eb3" strokeWidth="2" />

        {/* 后发 + 双马尾 */}
        <path d="M40 120 Q30 200 46 250 Q60 210 64 170 Z" fill="url(#hair)" />
        <path d="M160 120 Q170 200 154 250 Q140 210 136 170 Z" fill="url(#hair)" />
        <circle cx="46" cy="120" r="14" fill="#ffd0e6" />
        <circle cx="154" cy="120" r="14" fill="#ffd0e6" />

        {/* 脖子 */}
        <rect x="92" y="178" width="16" height="22" rx="6" fill="#ffe3ee" />

        {/* 头部（跟随鼠标旋转） */}
        <g ref={headRef}>
          {/* 脸 */}
          <ellipse cx="100" cy="120" rx="52" ry="56" fill="#fff0f4" />
          {/* 刘海 / 前发 */}
          <path
            d="M48 120 Q44 60 100 52 Q156 60 152 120 Q140 86 120 80 Q132 100 118 96 Q126 70 100 66 Q74 70 82 96 Q68 100 80 80 Q60 86 48 120 Z"
            fill="url(#hair)"
          />
          {/* 腮红 */}
          <ellipse cx="74" cy="138" rx="11" ry="7" fill="url(#cheek)" />
          <ellipse cx="126" cy="138" rx="11" ry="7" fill="url(#cheek)" />
          {/* 眼睛白 */}
          <ellipse cx="78" cy="122" rx="11" ry="14" fill="#ffffff" />
          <ellipse cx="122" cy="122" rx="11" ry="14" fill="#ffffff" />
          {/* 瞳孔（跟随鼠标平移） */}
          <g ref={leftPupil}>
            <ellipse cx="78" cy="123" rx="7" ry="10" fill="#8a5a9e" />
            <circle cx="75.5" cy="119" r="2.6" fill="#ffffff" />
          </g>
          <g ref={rightPupil}>
            <ellipse cx="122" cy="123" rx="7" ry="10" fill="#8a5a9e" />
            <circle cx="119.5" cy="119" r="2.6" fill="#ffffff" />
          </g>
          {/* 眉毛 */}
          <path d="M68 104 Q78 100 88 104" stroke="#e08aae" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M112 104 Q122 100 132 104" stroke="#e08aae" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {/* 嘴 */}
          <path d="M92 150 Q100 158 108 150" stroke="#d6658b" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}
