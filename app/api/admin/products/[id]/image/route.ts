import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

const KEY_PREFIX = "product_image:";

// Product images are stored as base64 data URLs inside SystemSetting
// (key = `product_image:<productId>`). We avoid a schema migration / disk
// writes because the app runs on Vercel (serverless, ephemeral filesystem),
// so the only persistent store we control is the database.
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: KEY_PREFIX + params.id },
    });
    return NextResponse.json({ image: row?.value ?? null });
  } catch (error) {
    console.error("read product image failed:", error);
    return NextResponse.json({ image: null });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { image } = await req.json();
    const id = params.id;

    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "无效的图片数据" }, { status: 400 });
    }
    // Guard total size (~3.5MB of base64) so a single row can't blow up the DB.
    if (image.length > 4_500_000) {
      return NextResponse.json({ error: "图片过大，请压缩后再上传（建议 ≤ 300KB）" }, { status: 413 });
    }

    await prisma.systemSetting.upsert({
      where: { key: KEY_PREFIX + id },
      update: { value: image },
      create: { key: KEY_PREFIX + id, value: image },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("save product image failed:", error);
    return NextResponse.json({ error: "保存图片失败" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });

  try {
    await prisma.systemSetting.deleteMany({ where: { key: KEY_PREFIX + params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("delete product image failed:", error);
    return NextResponse.json({ error: "删除图片失败" }, { status: 500 });
  }
}
