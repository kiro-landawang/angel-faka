import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StoreFront } from "@/components/store-front";
import { Navbar } from "@/components/navbar";
import { StoreFooter } from "@/components/store-footer";

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

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl px-5 pt-8">
        <p className="text-xs text-muted-foreground">独立店铺</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">{merchant.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">支付完成立即发卡</p>
        <div className="mt-8">
          <StoreFront categories={categories} featured />
        </div>
      </div>
      <StoreFooter />
    </main>
  );
}
