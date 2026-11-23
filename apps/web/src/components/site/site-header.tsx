'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { homeFor, useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

const NAV = [
  { href: '/courses', label: 'Courses' },
  { href: '/kids-quran-classes', label: 'Kids' },
  { href: '/teachers', label: 'Teachers' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader({ siteName, logoUrl }: { siteName: string; logoUrl?: string | null }) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo name={siteName} logoUrl={logoUrl} />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary',
                pathname.startsWith(n.href) ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <Button asChild><Link href={homeFor(user)}>My dashboard</Link></Button>
          ) : (
            <>
              <Button variant="ghost" asChild><Link href="/login">Log in</Link></Button>
              <Button asChild><Link href="/free-trial">Book a free trial</Link></Button>
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Toggle menu">
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open ? (
        <div className="border-t lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-1 px-4 py-3" aria-label="Mobile">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:bg-secondary rounded-md px-3 py-2.5 text-sm font-medium">{n.label}</Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {user ? (
                <Button className="col-span-2" asChild><Link href={homeFor(user)}>My dashboard</Link></Button>
              ) : (
                <>
                  <Button variant="outline" asChild><Link href="/login">Log in</Link></Button>
                  <Button asChild><Link href="/free-trial">Free trial</Link></Button>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
