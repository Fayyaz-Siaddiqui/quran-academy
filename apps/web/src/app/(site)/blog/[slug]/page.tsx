import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Container, CtaBand } from '@/components/site/sections';
import { getBlogPost, getSite } from '@/lib/content';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { formatDate } from '@/lib/utils';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const post = await getBlogPost((await params).slug);
  if (!post) return {};
  return pageMetadata({ title: post.metaTitle ?? post.title, description: post.metaDescription ?? post.excerpt, path: `/blog/${post.slug}`, image: post.coverImageUrl });
}

export default async function BlogPostPage({ params }: Props) {
  const [post, site] = await Promise.all([getBlogPost((await params).slug), getSite()]);
  if (!post) notFound();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    url: `${SITE_URL}/blog/${post.slug}`,
    author: { '@type': 'Person', name: post.author?.fullName ?? site.site.name },
    publisher: { '@type': 'Organization', name: site.site.name },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="py-14">
        <Container className="max-w-3xl">
          <Link href="/blog" className="text-primary text-sm hover:underline">← All articles</Link>
          <h1 className="mt-4 text-4xl font-bold">{post.title}</h1>
          <p className="text-muted-foreground mt-3 text-sm">
            {formatDate(post.publishedAt)}{post.author ? ` · ${post.author.fullName}` : ''}
          </p>
          {post.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.coverImageUrl} alt="" className="mt-8 aspect-[16/9] w-full rounded-xl object-cover" />
          ) : null}
          {/* react-markdown does not render raw HTML, so CMS content cannot inject scripts. */}
          <div className="prose-content mt-8"><ReactMarkdown>{post.content}</ReactMarkdown></div>
        </Container>
      </article>
      <CtaBand />
    </>
  );
}
