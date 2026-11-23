import { CmsPageView, cmsPageMetadata } from '@/components/site/legal-page';

export const generateMetadata = () => cmsPageMetadata('terms-and-conditions');

export default function Page() {
  return <CmsPageView slug="terms-and-conditions" />;
}
