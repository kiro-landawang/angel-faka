import { NextResponse } from "next/server";
import { customerLogout } from "@/lib/customer-auth";

export async function POST() {
  customerLogout();
  return NextResponse.json({ success: true });
}
