'use client';

import { PERMISSIONS } from '@qa/shared-types';
import { ExternalLink } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { BlogPanel } from '@/components/admin/cms/blog-panel';
import { FaqsPanel, PricingPanel, TestimonialsPanel } from '@/components/admin/cms/collections';
import { CoursesPanel } from '@/components/admin/cms/courses-panel';
import { PagesPanel } from '@/components/admin/cms/pages-panel';
import { SettingsPanel } from '@/components/admin/cms/settings-panel';
import { PageTitle } from '@/components/portal/portal-shell';
import { Button } from '@/components/ui/button';
import { EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { can, useAuthStore } from '@/lib/auth-store';

const TABS = [
  { value: 'settings', label: 'Site settings', perm: PERMISSIONS.CMS_MANAGE, Panel: SettingsPanel },
  { value: 'pages', label: 'Pages', perm: PERMISSIONS.CMS_MANAGE, Panel: PagesPanel },
  { value: 'courses', label: 'Courses', perm: PERMISSIONS.COURSES_MANAGE, Panel: CoursesPanel },
  { value: 'pricing', label: 'Pricing', perm: PERMISSIONS.CMS_MANAGE, Panel: PricingPanel },
  { value: 'testimonials', label: 'Testimonials', perm: PERMISSIONS.CMS_MANAGE, Panel: TestimonialsPanel },
  { value: 'faqs', label: 'FAQs', perm: PERMISSIONS.CMS_MANAGE, Panel: FaqsPanel },
  { value: 'blog', label: 'Blog', perm: PERMISSIONS.CMS_MANAGE, Panel: BlogPanel },
] as const;

function CmsScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const params = useSearchParams()!; // never null in the App Router (nullable only because src/pages exists)
  const tabs = TABS.filter((t) => can(user, t.perm));
  const requested = params.get('tab');
  const active = tabs.find((t) => t.value === requested)?.value ?? tabs[0]?.value;

  if (!tabs.length) return <EmptyState icon={ExternalLink} title="You don’t have access to the website editor" />;

  return (
    <>
      <PageTitle
        title="Website content"
        description="Changes go live on the public website as soon as you save."
        actions={<Button variant="outline" asChild><a href="/" target="_blank" rel="noreferrer"><ExternalLink /> View website</a></Button>}
      />
      <Tabs value={active} onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList>{tabs.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}</TabsList>
        </div>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-6"><t.Panel /></TabsContent>
        ))}
      </Tabs>
    </>
  );
}

export default function CmsPage() {
  return <Suspense><CmsScreen /></Suspense>;
}
