import { notFound } from 'next/navigation';
import { getPage } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';
import { formatDate } from '@/lib/utils';
import { CmsSections, Container, PageHero } from './sections';

export async function cmsPageMetadata(slug: string) {
  const page = await getPage(slug);
  if (!page) return {};
  return pageMetadata({ title: page.metaTitle ?? page.title, description: page.metaDescription ?? page.title, path: `/${slug}`, image: page.ogImageUrl });
}

export async function CmsPageView({ slug }: { slug: string }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <>
      <PageHero title={page.title} description={page.updatedAt ? `Last updated ${formatDate(page.updatedAt)}` : undefined} />
      <section className="py-14"><Container><CmsSections sections={page.sections} /></Container></section>
    </>
  );
}
