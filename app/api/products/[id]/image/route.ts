import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const KEY_PREFIX = "product_image:";

// Product images are public storefront assets. Serve the stored data URL as an
// image response so the catalog payload stays small and browsers can cache it.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const row = await prisma.systemSetting.findUnique({
    where: { key: KEY_PREFIX + params.id },
    select: { value: true },
  });

  const match = row?.value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return new NextResponse(null, { status: 404 });

  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
