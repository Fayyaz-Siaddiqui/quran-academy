import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="pattern-star flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-primary text-sm font-semibold">404</p>
      <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
      <p className="text-muted-foreground mt-3 max-w-md">The page you are looking for may have moved. Try the home page or browse our courses.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild><Link href="/">Home</Link></Button>
        <Button variant="outline" asChild><Link href="/courses">Courses</Link></Button>
      </div>
    </main>
  );
}
