import { NextResponse } from "next/server";
import { getCustomer } from "@/lib/customer-auth";
import { ensureLotterySchema } from "@/lib/db-migrate";

export async function GET() {
  await ensureLotterySchema();
  const customer = await getCustomer();
  if (!customer) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  return NextResponse.json({
    email: customer.email,
    points: customer.points,
    drawsAvailable: customer.drawsAvailable,
  });
}
