import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { CustomerService } from "@/components/customer-service";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="zh-CN">
      <body className={`${inter.className} bg-background text-foreground`} style={{ fontFamily: 'Inter, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif' }}>
        {children}
        <CustomerService crispId={crispId} />
      </body>
    </html>
  );
}
