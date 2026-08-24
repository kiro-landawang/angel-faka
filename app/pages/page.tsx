import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/navbar";
import { StoreFooter } from "@/components/store-footer";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HelpCenterPage() {
  const articles = await prisma.article.findMany({
    where: { isVisible: true },
    orderBy: { createdAt: "asc" }
  });

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
        <h1 className="text-4xl font-medium tracking-tight">帮助中心</h1>
        <p className="mt-3 text-sm text-muted-foreground">取货、售后和常见问题</p>
        <div className="mt-8 space-y-3">
          {articles.length === 0 ? (
            <div className="rounded-2xl bg-white px-5 py-16 text-center text-sm text-muted-foreground">
              暂无内容
            </div>
          ) : (
            articles.map((article) => (
              <Link
                key={article.slug}
                href={`/pages/${article.slug}`}
                className="flex items-center justify-between rounded-2xl bg-white px-5 py-4"
              >
                <div>
                  <p className="text-[15px] font-medium">{article.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    更新于 {new Date(article.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-muted-foreground">›</span>
              </Link>
            ))
          )}
        </div>
      </div>
      <StoreFooter />
    </main>
  );
}
