import { NextResponse } from "next/server";
import { AppreciationProvider } from "@/lib/payments/providers/appreciation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const provider = new AppreciationProvider();
    const intent = await provider.createPayment("", 0, "");
    return NextResponse.json({ qrCode: intent.qrCode || "" });
  } catch (e) {
    return NextResponse.json({ qrCode: "" });
  }
}
