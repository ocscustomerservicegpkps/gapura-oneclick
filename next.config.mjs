import withSerwist from '@serwist/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
    distDir: process.env.NEXT_DIST_DIR || '.next',
    poweredByHeader: false,
    compress: true,

    // Auto-memoization: kills cascade re-renders in the large client
    // components (wizard/tab monoliths) without manual memo() work.
    reactCompiler: true,

    experimental: {
        optimizePackageImports: [
            'lucide-react',
            'recharts',
            'framer-motion',
            'date-fns',
        ],
        workerThreads: false,
    },

    compiler: {
        removeConsole: process.env.NODE_ENV === 'production'
            ? { exclude: ['error', 'warn'] }
            : false,
    },

    turbopack: {
        // [FIX] Explicitly declare the project root to silence the
        // "Next.js inferred your workspace root" warning caused by
        // multiple lockfiles (bun.lock + package-lock.json).
        root: process.cwd(),
    },

    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                fs: false,
                path: false,
            };
        }
        return config;
    },

    images: {
        formats: ['image/avif', 'image/webp'],
        qualities: [70, 75, 80],
        minimumCacheTTL: 86400,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.supabase.co',
            },
            {
                protocol: 'https',
                hostname: '**.supabase.in',
            },
            {
                protocol: 'https',
                hostname: 'gapura-my.sharepoint.com',
            },
            {
                protocol: 'https',
                hostname: 'api.qrserver.com',
            },
        ],
    },

    redirects: async () => [
        // ponytail: handle `/` at the routing layer so the `Home` Server
        // Component never renders. Avoids a Turbopack perf-measure crash
        // ("'Home' cannot have a negative time stamp") triggered when the
        // component throws `redirect()` before its perf mark lands.
        { source: '/', destination: '/auth/login', permanent: false },
    ],

    headers: async () => [
        {
            source: "/(.*)",
            headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "X-XSS-Protection", value: "1; mode=block" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
                { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
                {
                    key: "Content-Security-Policy",
                    value: [
                        "default-src 'self'",
                        `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''} https://vercel.live`,
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                        "font-src 'self' https://fonts.gstatic.com",
                        "img-src 'self' data: blob: https:",
                        "connect-src 'self' https:",
                        "frame-ancestors 'none'",
                        "base-uri 'self'",
                        "form-action 'self'",
                    ].join("; "),
                },
            ],
        },
        {
            source: "/api/master-data",
            headers: [
                { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
            ],
        },
        {
            source: "/sw.js",
            headers: [
                { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                {
                    key: "Content-Security-Policy",
                    value: "default-src 'self'; script-src 'self'; connect-src 'self' https:; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';",
                },
            ],
        },
        {
            source: "/manifest.webmanifest",
            headers: [
                { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
            ],
        },
        {
            source: "/(.*).css",
            headers: [
                { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
            ],
        },
    ],
};

const withSerwistConfig = withSerwist({
    swSrc: 'app/sw.ts',
    swDest: 'public/sw.js',
    cacheOnNavigation: true,
});

export default withSerwistConfig(nextConfig);
