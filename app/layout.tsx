
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono, Fraunces, Bricolage_Grotesque, Hanken_Grotesk } from 'next/font/google';
import { MotionConfig } from 'framer-motion';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ['latin'],
    display: 'swap',
    preload: true,
    adjustFontFallback: true,
    variable: '--font-plus-jakarta',
});

// Display face — idiosyncratic editorial grotesque for headlines & big numbers.
// App-wide default (dashboards/embed); auth routes pin back to Plus Jakarta in auth-theme.css.
const bricolageGrotesque = Bricolage_Grotesque({
    subsets: ['latin'],
    display: 'swap',
    preload: true,
    adjustFontFallback: true,
    weight: ['600', '700', '800'],
    variable: '--font-bricolage',
});

// Body face — warm, highly readable grotesque for prose, labels, inputs, buttons.
const hankenGrotesk = Hanken_Grotesk({
    subsets: ['latin'],
    display: 'swap',
    preload: true,
    adjustFontFallback: true,
    variable: '--font-hanken',
});

// Editorial display serif — applied ONLY inside `.cf-root` (Customer Feedback dashboard).
// Loading it globally is harmless: unused elsewhere because nothing else references the variable.
const fraunces = Fraunces({
    subsets: ['latin'],
    display: 'swap',
    preload: false,
    adjustFontFallback: true,
    axes: ['opsz', 'SOFT', 'WONK'],
    variable: '--font-fraunces',
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400'],
    display: 'swap',
    preload: false,
    adjustFontFallback: true,
    variable: '--font-jetbrains-mono',
});

const metadataBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000');

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#0f766e',
};

export const metadata: Metadata = {
    metadataBase: new URL(metadataBaseUrl),
    title: 'Gapura OneClick',
    applicationName: 'OneClick',
    description: 'Gapura OneClick - Airport Operations Reporting & Monitoring System',
    manifest: '/manifest.webmanifest',
    icons: {
        icon: '/icons/pwa-192.png',
        shortcut: '/icons/pwa-192.png',
        apple: '/icons/pwa-192.png',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'OneClick',
    },
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    openGraph: {
        type: 'website',
        siteName: 'OneClick',
        title: 'Gapura OneClick',
        description: 'Airport Operations Reporting & Monitoring System',
        images: [
            {
                url: '/icons/pwa-512.png',
                width: 512,
                height: 512,
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Gapura OneClick',
        description: 'Airport Operations Reporting & Monitoring System',
        images: [
            {
                url: '/icons/pwa-512.png',
                width: 512,
                height: 512,
            },
        ],
    },
    robots: {
        index: true,
        follow: true,
    },

};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="id" data-scroll-behavior="smooth" className={`${plusJakartaSans.variable} ${bricolageGrotesque.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}>
            <body>
                {/* Every framer-motion m.* animation app-wide reads this — without it,
                    spring/slide entrances ignore the OS-level reduced-motion preference,
                    since it's JS-driven and the global CSS reduced-motion rule can't reach it. */}
                <MotionConfig reducedMotion="user">
                    {children}
                </MotionConfig>
            </body>
        </html>
    );
}
