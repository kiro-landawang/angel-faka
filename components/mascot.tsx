// 左右看板娘：AI 生成的二次元角色（透明背景 WebP，public/mascot-*.min.webp）。
//
// 性能说明（重要，别再改回去）：
// 旧实现用全局 mousemove + rAF，每帧对两张 800×1200 的图调用
// getBoundingClientRect() 再写 transform —— 读写混排触发强制同步布局
// （layout thrashing），配合 drop-shadow 滤镜重绘，鼠标一动整页掉帧。
// 现在改为纯静态渲染：0 事件监听、0 JS、0 滤镜、0 合成层，
// 图片按显示尺寸预缩到 360px 宽（35KB / 41KB），滚动与移动鼠标都无额外开销。
export function Mascot() {
  return (
    <>
      {/* 左：黑发 */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 z-30 hidden select-none sm:block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot-left.min.webp"
          alt=""
          width={360}
          height={540}
          loading="lazy"
          decoding="async"
          className="block h-auto w-[150px] lg:w-[170px]"
        />
      </div>

      {/* 右：紫发（水平镜像，朝向页面内侧） */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 right-0 z-30 hidden select-none sm:block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot-right.min.webp"
          alt=""
          width={360}
          height={540}
          loading="lazy"
          decoding="async"
          className="block h-auto w-[150px] lg:w-[170px]"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>
    </>
  )
}
