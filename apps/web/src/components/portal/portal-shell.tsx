'use client';

import { PERMISSIONS } from '@qa/shared-types';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  Building2,
  History,
  Inbox,
  Megaphone,
  UserPlus,
  CalendarDays,
  ClipboardList,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PlayCircle,
  Shield,
  TrendingUp,
  User,
  UserCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/site/logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { can, hasRole, useAuthStore } from '@/lib/auth-store';
import { useRealtime } from '@/lib/realtime';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean };

function useNav(): NavItem[] {
  const user = useAuthStore((s) => s.user);
  const items: NavItem[] = [];
  if (hasRole(user, 'student')) {
    items.push(
      { href: '/student', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/student/classes', label: 'My classes', icon: CalendarDays },
      { href: '/student/courses', label: 'Courses & lessons', icon: BookOpen },
      { href: '/student/homework', label: 'Homework', icon: ClipboardList },
      { href: '/student/recordings', label: 'Recordings', icon: PlayCircle },
      { href: '/student/progress', label: 'Quran progress', icon: TrendingUp },
      { href: '/student/profile', label: 'My profile & teacher', icon: UserRound },
    );
  }
  if (hasRole(user, 'parent')) {
    items.push(
      { href: '/parent', label: 'Family overview', icon: LayoutDashboard, exact: true },
      { href: '/parent/children', label: 'My children', icon: Users },
    );
  }
  if (hasRole(user, 'teacher')) {
    items.push(
      { href: '/teacher', label: 'Teaching dashboard', icon: GraduationCap, exact: true },
      { href: '/teacher/classes', label: 'Schedule', icon: CalendarDays },
      { href: '/teacher/students', label: 'My students', icon: Users },
      { href: '/teacher/homework', label: 'Homework', icon: ClipboardList },
      { href: '/teacher/profile', label: 'Profile & availability', icon: UserRound },
    );
  }
  const cms = can(user, PERMISSIONS.CMS_MANAGE) || can(user, PERMISSIONS.COURSES_MANAGE);
  // Staff-only permissions (teachers also hold classes.read / courses.read, so those can't gate the section).
  const staff = [PERMISSIONS.USERS_READ, PERMISSIONS.STUDENTS_READ, PERMISSIONS.TEACHERS_READ, PERMISSIONS.ROLES_READ, PERMISSIONS.LEADS_READ, PERMISSIONS.AUDIT_READ, PERMISSIONS.ANNOUNCEMENTS_MANAGE]
    .some((p) => can(user, p)) || cms;
  if (staff) {
    const add = (ok: boolean, item: NavItem) => ok && items.push(item);
    add(true, { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true });
    add(can(user, PERMISSIONS.CLASSES_MANAGE) || (can(user, PERMISSIONS.CLASSES_READ) && can(user, PERMISSIONS.STUDENTS_READ)), { href: '/admin/schedule', label: 'Schedule', icon: CalendarDays });
    add(can(user, PERMISSIONS.STUDENTS_READ), { href: '/admin/enrollments', label: 'Enrolments', icon: UserPlus });
    add(can(user, PERMISSIONS.LEADS_READ), { href: '/admin/leads', label: 'Leads inbox', icon: Inbox });
    add(can(user, PERMISSIONS.USERS_READ), { href: '/admin/users', label: 'Users', icon: Users });
    add(can(user, PERMISSIONS.TEACHERS_READ), { href: '/admin/teacher-approvals', label: 'Teacher approvals', icon: UserCheck });
    add(can(user, PERMISSIONS.ANNOUNCEMENTS_MANAGE), { href: '/admin/announcements', label: 'Announcements', icon: Megaphone });
    add(cms, { href: '/admin/cms', label: 'Website content', icon: Globe });
    add(can(user, PERMISSIONS.ROLES_READ), { href: '/admin/roles', label: 'Roles & permissions', icon: Shield });
    add(can(user, PERMISSIONS.BRANCHES_READ), { href: '/admin/branches', label: 'Branches', icon: Building2 });
    add(can(user, PERMISSIONS.AUDIT_READ), { href: '/admin/audit', label: 'Audit log', icon: History });
  }
  items.push({ href: '/notifications', label: 'Notifications', icon: Bell }, { href: '/account', label: 'Account & security', icon: User });
  return items;
}

function NotificationBell() {
  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api<{ unreadCount: number }>('/notifications?unread=true'),
    refetchInterval: 120_000,
  });
  const count = data?.unreadCount ?? 0;
  return (
    <Button variant="ghost" size="icon" asChild>
      <Link href="/notifications" aria-label={`Notifications${count ? `, ${count} unread` : ''}`} className="relative">
        <Bell />
        {count ? (
          <span className="bg-destructive absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { user, ready, clear } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const nav = useNav();
  const [mobileOpen, setMobileOpen] = useState(false);
  useRealtime();

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, pathname]);
  useEffect(() => setMobileOpen(false), [pathname]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy>
        <Loader2 className="text-primary size-8 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clear();
    router.replace('/login');
  };

  const sidebar = (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Portal">
      {nav.map((n) => {
        const active = n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-sidebar-accent text-white' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white',
            )}
          >
            <n.icon className="size-4" aria-hidden />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 py-5 lg:flex">
        <div className="px-5"><Logo name="Quran Academy" light /></div>
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="bg-sidebar text-sidebar-foreground absolute inset-y-0 left-0 flex w-72 flex-col gap-6 py-5">
            <div className="flex items-center justify-between px-5">
              <Logo name="Quran Academy" light />
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></Button>
            </div>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></Button>
          <div className="flex-1" />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label="Account menu">
              <UserAvatar name={user.fullName} src={user.avatarUrl} className="size-8" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate">{user.fullName}</p>
                <p className="text-muted-foreground truncate text-xs font-normal">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/account"><User /> Account & security</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/"><BookOpen /> Public website</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={logout} className="text-destructive"><LogOut /> Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
