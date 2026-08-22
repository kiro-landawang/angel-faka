import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

const ALLOWED_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const { status } = await req.json();
    if (!ALLOWED_STATUSES.has(status)) return NextResponse.json({ error: "Invalid merchant status" }, { status: 400 });
    const merchant = await prisma.merchant.update({ where: { id: params.id }, data: { status } });
    return NextResponse.json({ id: merchant.id, status: merchant.status });
  } catch {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }
}
