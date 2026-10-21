import type { Metadata } from "next";
import { Rajdhani } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { CustomerService } from "@/components/customer-service";

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
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "crisp_id" },
    });
    crispId = setting?.value;
  } catch (error) {
    console.warn("Failed to fetch crisp_id (likely during build):", error);
  }

  return (
    <html lang="zh-CN" className={arkFont.variable}>
      <body className="bg-background text-foreground" style={{ fontFamily: 'Inter, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif' }}>
        {children}
        <CustomerService crispId={crispId} />
      </body>
    </html>
  );
}
