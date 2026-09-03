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
  const imageMap = new Map<string, string>();

  try {
    await getDefaultMerchantId();
    categoriesData = await prisma.category.findMany({
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
    });

    contactInfo = await prisma.systemSetting.findUnique({
      where: { key: "site_contact_info" },
    });

    announcement = await prisma.systemSetting.findUnique({
      where: { key: "site_announcement" },
    });

    try {
      const imageRows = await prisma.systemSetting.findMany({
        where: { key: { startsWith: "product_image:" } },
      });
      for (const row of imageRows) imageMap.set(row.key.replace("product_image:", ""), row.value);
    } catch {}
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
        image: imageMap.get(p.id) ?? null,
      }))
  }));

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl px-5 pt-4">
        <Announcement content={announcement?.value || undefined} />
        <StoreFront categories={categories} featured />
      </div>
      <StoreFooter contact={contactInfo?.value} />
    </main>
  );
}
