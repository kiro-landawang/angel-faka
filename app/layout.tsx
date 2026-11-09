import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Rajdhani } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { CustomerService } from "@/components/customer-service";
import { BgmPlayer } from "@/components/bgm-player";

// 方舟风几何字体（Bender 平替）：仅用于价格/编号等展示元素，构建时自托管
const arkFont = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-ark",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ANGEL旗舰 - 自动发货平台",
  description: "ANGEL旗舰数字商品自动发货平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let crispId = undefined;
  let bgmUrl: string | undefined = undefined;
  let bgmVolume = 35;

  // 站内默认音乐：public/music/bgm.mp3（或 bgm.wav / bgm.ogg）存在就自动启用，
  // 不存在就不挂音频请求，避免每个访客都吃一个 404
  const localBgm = (() => {
    for (const name of ["bgm.mp3", "bgm.wav", "bgm.ogg"]) {
      try {
        if (existsSync(join(process.cwd(), "public", "music", name))) return `/music/${name}`;
      } catch {
        // ignore
      }
    }
    return "";
  })();

  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ["crisp_id", "bgm_url", "bgm_volume"] } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    crispId = map["crisp_id"];

    // 语义：后台没配过 bgm_url → 用站内默认文件；配了空值 → 明确关闭；配了值 → 用配置值
    const hasKey = Object.prototype.hasOwnProperty.call(map, "bgm_url");
    const raw = (hasKey ? String(map["bgm_url"] ?? "") : localBgm).trim();
    // 只接受站内路径或 http(s) 直链，挡掉 javascript: 之类的脏协议
    if (raw && (/^\/[^\s]*$/.test(raw) || /^https?:\/\//i.test(raw))) {
      bgmUrl = raw;
    }
    const vol = Number(map["bgm_volume"]);
    if (map["bgm_volume"] !== undefined && Number.isFinite(vol) && vol >= 0 && vol <= 100) {
      bgmVolume = vol;
    }
  } catch (error) {
    console.warn("Failed to fetch site settings (likely during build):", error);
    if (localBgm) bgmUrl = localBgm;
  }

  return (
    <html lang="zh-CN" className={arkFont.variable}>
      <body className="bg-background text-foreground" style={{ fontFamily: 'Inter, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif' }}>
        {children}
        <CustomerService crispId={crispId} />
        <BgmPlayer src={bgmUrl} volume={bgmVolume} />
      </body>
    </html>
  );
}
