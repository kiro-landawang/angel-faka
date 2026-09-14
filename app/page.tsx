import { Navbar } from "@/components/navbar";
import { StoreFront } from "@/components/store-front";
import { RainbowBanner } from "@/components/rainbow-banner";
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
    <main className="relative flex min-h-screen flex-col text-zinc-900">
      {/* 背景：近白底 + 极淡彩色光斑，供液态玻璃折射出苹果那种会流动的高级感 */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 12% 8%, rgba(226,114,91,0.12), transparent 60%), radial-gradient(55% 45% at 88% 18%, rgba(140,120,230,0.12), transparent 60%), radial-gradient(60% 50% at 75% 92%, rgba(90,160,230,0.10), transparent 60%), #fbfbfd",
        }}
      />
      <Navbar />
      <div className="mx-auto w-full max-w-7xl px-5 pt-8 sm:px-8 lg:px-10">
        <RainbowBanner />
        <Announcement content={announcement?.value || undefined} />
        <StoreFront categories={categories} featured />
      </div>
      <StoreFooter contact={contactInfo?.value} />
    </main>
  );
}
