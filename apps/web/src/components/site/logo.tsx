import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Uploaded logo from the CMS when set; otherwise the eight-pointed star (Rub el Hizb) mark. Always paired with the wordmark. */
export function Logo({ name, className, light, logoUrl }: { name: string; className?: string; light?: boolean; logoUrl?: string | null }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5 font-semibold', className)} aria-label={`${name} home`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-8 shrink-0 object-contain" />
      ) : (
        <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
          <rect x="6" y="6" width="20" height="20" rx="2" className="fill-primary" />
          <rect x="6" y="6" width="20" height="20" rx="2" transform="rotate(45 16 16)" className="fill-primary" />
          <circle cx="16" cy="16" r="5.5" className="fill-gold" />
        </svg>
      )}
      <span className={cn('leading-tight', light ? 'text-white' : 'text-foreground')}>{name}</span>
    </Link>
  );
}
