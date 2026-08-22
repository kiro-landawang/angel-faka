import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { purgeExpiredRecords } from "@/lib/retention";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.RETENTION_PURGE_TOKEN;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await purgeExpiredRecords();
  return NextResponse.json({ success: true, deletedOrders: result.deletedOrders });
}
