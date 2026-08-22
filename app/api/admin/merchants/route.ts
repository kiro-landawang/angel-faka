import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

export async function GET(req: Request) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const merchants = await prisma.merchant.findMany({
    where: status && status !== "ALL" ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, username: true, name: true, slug: true, status: true, createdAt: true,
      _count: { select: { products: true, orders: true } },
    },
  });
  return NextResponse.json({ merchants });
}
