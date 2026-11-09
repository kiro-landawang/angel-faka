import type { Metadata } from "next";
import { Rajdhani } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { CustomerService } from "@/components/customer-service";
import { BgmPlayer } from "@/components/bgm-player";

/**
 * 站内默认背景音乐池：每次进站（服务端渲染时）随机抽一首。
 * 后台「背景音乐 → 音乐地址」可覆盖（支持多行，同样随机抽），清空则关闭。
 */
const DEFAULT_BGM_LIST = ["/music/bgm.mp3", "/music/bgm2.mp3"];

/** 只放行站内路径与 http(s) 直链，挡掉 javascript: 之类的脏协议 */
function isSafeAudioUrl(url: string) {
  return /^\/[^\s]*$/.test(url) || /^https?:\/\//i.test(url);
}

function pickRandomBgm(urls: string[]): string | undefined {
  const valid = urls.filter(isSafeAudioUrl);
  if (valid.length === 0) return undefined;
  return valid[Math.floor(Math.random() * valid.length)];
}

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
  let bgmVolume = 20;

  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ["crisp_id", "bgm_url", "bgm_volume"] } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    crispId = map["crisp_id"];

    // 语义：后台没配过 bgm_url → 用站内默认音乐池；配了空值 → 明确关闭；
    // 配了值 → 用配置值（多行/逗号分隔视为候选池，随机抽一首）
    // 注意：不能用 existsSync 检测 public/ 下的文件 —— Vercel 的 Serverless 函数里
    // 没有 public 目录（静态资源由 CDN 直出），检测会永远为 false，导致音乐不生效。
    const hasKey = Object.prototype.hasOwnProperty.call(map, "bgm_url");
    const candidates = hasKey
      ? String(map["bgm_url"] ?? "")
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : DEFAULT_BGM_LIST;
    bgmUrl = pickRandomBgm(candidates);

    const vol = Number(map["bgm_volume"]);
    if (map["bgm_volume"] !== undefined && Number.isFinite(vol) && vol >= 0 && vol <= 100) {
      bgmVolume = vol;
    }
  } catch (error) {
    console.warn("Failed to fetch site settings (likely during build):", error);
    bgmUrl = pickRandomBgm(DEFAULT_BGM_LIST);
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
