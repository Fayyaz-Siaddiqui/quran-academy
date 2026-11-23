import { CmsPageView, cmsPageMetadata } from '@/components/site/legal-page';

export const generateMetadata = () => cmsPageMetadata('privacy-policy');

export default function Page() {
  return <CmsPageView slug="privacy-policy" />;
}
