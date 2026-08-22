import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StoreFront } from "@/components/store-front";
import { Navbar } from "@/components/navbar";

export const dynamic = "force-dynamic";

export default async function MerchantShopPage({ params }: { params: { slug: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      name: true,
      status: true,
      categories: {
        orderBy: { priority: "desc" },
        include: {
          products: {
            where: { isActive: true },
            include: {
              sourceProduct: {
                include: {
                  _count: { select: { licenses: { where: { status: "AVAILABLE" } } } }
                }
              },
              _count: { select: { licenses: { where: { status: "AVAILABLE" } } } }
            },
          },
        },
      },
    },
  });

  if (!merchant || merchant.status !== "APPROVED") notFound();

  const categories = merchant.categories.map((category) => ({
    id: category.id,
    name: category.name,
    products: category.products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      stock: product.sourceProduct?._count.licenses ?? product._count.licenses,
    })),
  }));

  return <main className="min-h-screen bg-background dark text-foreground"><Navbar /><div className="container mx-auto max-w-6xl px-4 pt-8"><h1 className="text-2xl font-bold">{merchant.name}</h1><p className="mt-1 text-sm text-muted-foreground">店铺商品</p></div><section className="container mx-auto max-w-6xl px-4 py-8"><StoreFront categories={categories} /></section></main>;
}
