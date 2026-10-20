import { Navbar } from "@/components/navbar";
import { StoreFront } from "@/components/store-front";
import { prisma } from "@/lib/prisma";
import { Announcement } from "@/components/announcement";
import { StoreFooter } from "@/components/store-footer";
import { getDefaultMerchantId } from "@/lib/platform-merchant";

// Cache the catalog HTML for 30s (ISR) so Vercel serves it from CDN instead of
// running a DB query on every request — much faster first paint / time-to-interactive.
export const revalidate = 30;

export default async function Home() {
  let categoriesData: any[] = [];
  let contactInfo: any = null;
  let announcement: any = null;
  try {
    await getDefaultMerchantId();
    [categoriesData, contactInfo, announcement] = await Promise.all([
      prisma.category.findMany({
        where: { merchant: { status: "APPROVED" } },
        orderBy: { priority: "desc" },
        include: {
          products: {
            where: {
              isActive: true,
              merchant: { status: "APPROVED" },
            },
            include: {
              sourceProduct: {
                include: {
                  _count: {
                    select: { licenses: { where: { status: "AVAILABLE" } } }
                  }
                }
              },
              _count: {
                select: { licenses: { where: { status: "AVAILABLE" } } }
              }
            }
          }
        }
      }),
      prisma.systemSetting.findUnique({ where: { key: "site_contact_info" } }),
      prisma.systemSetting.findUnique({ where: { key: "site_announcement" } }),
    ]);
  } catch (error) {
    console.warn("Failed to fetch homepage data (likely during build):", error);
  }

  const categories = categoriesData.map(cat => ({
    id: cat.id,
    name: cat.name,
      products: cat.products.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price.toString(),
        stock: p.sourceProduct?._count.licenses ?? p._count.licenses,
        image: `/api/products/${p.id}/image`,
      }))
  }));

  return (
    <main className="theme-dark relative flex min-h-screen flex-col text-foreground">
      {/* 暗色底 + 三团静态氛围光（radial-gradient 只画一次，无滤镜无动画，滚动零重绘） */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#0A0A0C]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(45% 42% at 10% 2%, rgba(226,114,91,0.16), transparent 62%), radial-gradient(40% 38% at 92% 14%, rgba(120,80,220,0.13), transparent 62%), radial-gradient(50% 46% at 60% 100%, rgba(226,114,91,0.07), transparent 62%)",
        }}
      />
      <Navbar />
      <div className="mx-auto w-full max-w-7xl flex-1 px-5 sm:px-8 lg:px-10">
        <Announcement content={announcement?.value || undefined} />
        <StoreFront categories={categories} featured />
      </div>
      <StoreFooter contact={contactInfo?.value} />
    </main>
  );
}
