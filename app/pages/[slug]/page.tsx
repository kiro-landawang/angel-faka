import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { StoreFooter } from "@/components/store-footer";
import ReactMarkdown from "react-markdown";
import { Metadata } from "next";
import Link from "next/link";

interface ArticlePageProps {
  params: {
    slug: string
  }
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug }
  });

  if (!article) return { title: "Not Found" };

  return {
    title: `${article.title} - ANGEL旗舰`,
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug }
  });

  if (!article || !article.isVisible) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
        <Link href="/pages" className="text-sm text-muted-foreground hover:text-foreground">返回帮助</Link>
        <article className="prose prose-zinc mt-6 max-w-none prose-headings:font-medium">
          <h1>{article.title}</h1>
          <div className="text-sm text-muted-foreground">
            更新于 {new Date(article.updatedAt).toLocaleDateString()}
          </div>
          <ReactMarkdown>{article.content || ""}</ReactMarkdown>
        </article>
      </div>
      <StoreFooter />
    </main>
  );
}
