import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getDefaultMerchantId } from "@/lib/platform-merchant";

const log = logger.child({ module: 'AdminProduct' });
const IMAGE_KEY_PREFIX = "product_image:";

// List Products
export async function GET(req: Request) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const categoryId = searchParams.get("categoryId");

  const skip = (page - 1) * limit;

  const where = categoryId && categoryId !== "all" ? { categoryId } : {};

  try {
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          _count: {
            select: { licenses: { where: { status: "AVAILABLE" } } }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.product.count({ where })
    ]);

    // Return the current page's thumbnails with the product list. This replaces
    // the old browser-side N+1 requests (one authenticated API call per image).
    const imageRows = products.length === 0
      ? []
      : await prisma.systemSetting.findMany({
          where: { key: { in: products.map((product) => `${IMAGE_KEY_PREFIX}${product.id}`) } },
          select: { key: true, value: true },
        });
    const images = Object.fromEntries(
      imageRows.map((row) => [row.key.slice(IMAGE_KEY_PREFIX.length), row.value])
    );

    return NextResponse.json({
      products,
      images,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      }
    });
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : "unknown" }, "Failed to fetch products");
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

// Create Product
export async function POST(req: Request) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { name, description, price, categoryId, deliveryFormat, allowResale = false, resalePrice, resaleMinPrice } = await req.json();
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { merchantId: true },
    });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 400 });

    const merchantId = category.merchantId || await getDefaultMerchantId();
    if (!merchantId) {
      return NextResponse.json({ error: "No approved platform merchant is configured" }, { status: 409 });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        categoryId,
        merchantId,
        deliveryFormat: deliveryFormat || "SINGLE",
        allowResale: Boolean(allowResale),
        resalePrice: resalePrice === undefined || resalePrice === "" ? null : Number(resalePrice),
        resaleMinPrice: resaleMinPrice === undefined || resaleMinPrice === "" ? null : Number(resaleMinPrice)
      }
    });
    
    log.info({ productId: product.id, name }, "Product created");
    return NextResponse.json(product);
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : "unknown" }, "Failed to create product");
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
