import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

const API = `${(process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`;

/**
 * Called by the CMS screens after a save so the public website reflects the
 * change immediately instead of after the 5-minute ISR window.
 *
 * Authorization is delegated to the API: the caller's access token must belong
 * to a user holding `cms.manage` (or a super admin).
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const me = await fetch(`${API}/auth/me`, { headers: { Authorization: auth }, cache: 'no-store' }).catch(() => null);
  if (!me?.ok) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const user = (await me.json()) as { roles: string[]; permissions: string[] };
  if (!user.roles.includes('super-admin') && !user.permissions.includes('cms.manage')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  revalidateTag('cms', { expire: 0 });
  return NextResponse.json({ revalidated: true });
}
