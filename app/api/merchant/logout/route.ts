import { NextResponse } from "next/server";
import { merchantLogout } from "@/lib/merchant-auth";

export async function GET() {
  await merchantLogout();
  return NextResponse.json({ success: true });
}
