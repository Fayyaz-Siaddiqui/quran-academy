import Link from 'next/link';
import { Container, PageHero } from '@/components/site/sections';
import { getBlog } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';
import { formatDate } from '@/lib/utils';

export const metadata = pageMetadata({
  title: 'Blog — Quran Learning Tips & Guides',
  description: 'Practical guidance on learning the Quran, tajweed, Hifz and helping children learn at home.',
  path: '/blog',
});

export default async function BlogPage() {
  const posts = await getBlog();
  return (
    <>
      <PageHero eyebrow="Blog" title="Guides for students and parents" />
      <section className="py-16">
        <Container>
          {posts.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="group bg-card flex flex-col overflow-hidden rounded-xl border shadow-xs transition-shadow hover:shadow-md">
                  {p.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverImageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
                  ) : (
                    <div className="pattern-star bg-secondary aspect-[16/9] w-full" aria-hidden />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-muted-foreground text-xs">{formatDate(p.publishedAt)}</p>
                    <h2 className="group-hover:text-primary mt-2 text-lg font-semibold">{p.title}</h2>
                    <p className="text-muted-foreground mt-2 flex-1 text-sm">{p.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center">No articles yet — check back soon.</p>
          )}
        </Container>
      </section>
    </>
  );
}
