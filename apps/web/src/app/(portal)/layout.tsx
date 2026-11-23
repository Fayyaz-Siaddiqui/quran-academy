import { PortalShell } from '@/components/portal/portal-shell';
import { NO_INDEX } from '@/lib/seo';

export const metadata = { ...NO_INDEX, title: 'Portal' };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
