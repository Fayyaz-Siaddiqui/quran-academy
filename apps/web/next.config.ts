import type { NextConfig } from 'next';

const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').origin;
  } catch {
    return 'http://localhost:4000';
  }
})();

/**
 * Content-Security-Policy. Zoom Video SDK needs its asset CDN, WebAssembly,
 * workers (blob:) and wss connections to Zoom media servers.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://source.zoom.us https://dmogdx0jrul3u.cloudfront.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' ${apiOrigin} ${apiOrigin.replace(/^http/, 'ws')} https://*.zoom.us wss://*.zoom.us https://source.zoom.us https://*.r2.cloudflarestorage.com https://*.amazonaws.com`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/**
 * Optional same-origin proxy: when API_PROXY_TARGET is set (and NEXT_PUBLIC_API_URL is empty),
 * the browser talks to /api/v1 and /socket.io on this site and Next forwards them to the API.
 * Used for single-link demos/tunnels; production uses api.yourdomain.com directly.
 */
const proxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // socket.io polling uses "/socket.io/?EIO=…"; don't let Next strip the slash.
  skipTrailingSlashRedirect: !!proxyTarget,
  async rewrites() {
    if (!proxyTarget) return [];
    return [
      { source: '/api/v1/:path*', destination: `${proxyTarget}/api/v1/:path*` },
      // Socket.IO needs the trailing slash preserved ("/socket.io/?EIO=…"); the :path* form drops it.
      { source: '/socket.io/', destination: `${proxyTarget}/socket.io/` },
      { source: '/socket.io/:path+', destination: `${proxyTarget}/socket.io/:path+` },
    ];
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        // Zoom Video SDK uses SharedArrayBuffer for best performance in the classroom.
        source: '/classroom/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ];
  },
};

export default nextConfig;
