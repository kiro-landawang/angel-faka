import { NextResponse } from "next/server";
import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function GET() {
  const merchant = await getCurrentMerchant();
  if (!merchant) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ merchant });
}
