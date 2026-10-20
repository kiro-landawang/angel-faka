// 左右看板娘：AI 生成的二次元角色（透明背景 WebP，public/mascot-*.min.webp）。
//
// 性能说明（2026-10-20 重做）：
//   旧版在 window 上挂 mousemove，每帧对两张 800×1200 大图调 getBoundingClientRect()
//   并写 transform，还叠了 drop-shadow 滤镜 —— 鼠标一动整页就重新布局 + 重绘阴影，
//   是"页面发涩/卡顿"的主因之一。
//   现改为纯静态：无 JS 监听、无滤镜、图片按显示尺寸预缩(360px 宽)，
//   解码内存从 ~7.7MB 降到 ~1.5MB，完全不占用主线程。
//   也不再是 client component，直接参与服务端渲染。
export function Mascot() {
  return (
    <>
      {/* 左：黑发 */}
      <div aria-hidden className="pointer-events-none fixed bottom-0 left-0 z-30 hidden select-none sm:block">
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
      <div aria-hidden className="pointer-events-none fixed bottom-0 right-0 z-30 hidden select-none sm:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot-right.min.webp"
          alt=""
          width={360}
          height={541}
          loading="lazy"
          decoding="async"
          className="block h-auto w-[150px] -scale-x-100 lg:w-[170px]"
        />
      </div>
    </>
  )
}
