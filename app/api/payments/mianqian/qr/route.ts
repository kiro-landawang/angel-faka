import { NextResponse } from "next/server";
import { MianQianProvider } from "@/lib/payments/providers/mianqian";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ch = searchParams.get("ch") || "alipay";

  try {
    const provider = new MianQianProvider();
    const qrCode = await provider.getQrUrl(ch);
    return NextResponse.json({ qrCode, channel: ch });
  } catch {
    return NextResponse.json({ qrCode: "", channel: ch });
  }
}
