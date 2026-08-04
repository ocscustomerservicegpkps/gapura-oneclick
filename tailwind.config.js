/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        screens: {
            'sm': '640px',
            'md': '768px',
            'lg': '1024px',
            'xl': '1280px',
            '2xl': '1536px',
        },
        extend: {
            /* PRISM V3 — Perceptual Color Physics */
            colors: {
                surface: {
                    0: 'var(--surface-0)',
                    1: 'var(--surface-1)',
                    2: 'var(--surface-2)',
                    3: 'var(--surface-3)',
                    4: 'var(--surface-4)',
                    glass: 'var(--surface-glass)',
                },
                brand: {
                    emerald: {
                        50: 'var(--brand-emerald-50)',
                        100: 'var(--brand-emerald-100)',
                        400: 'var(--brand-emerald-400)',
                        500: 'var(--brand-emerald-500)',
                        600: 'var(--brand-emerald-600)',
                        700: 'var(--brand-emerald-700)',
                    },
                    primary: 'var(--brand-primary)',
                    accent: 'var(--brand-accent)',
                },
                accent: {
                    cyan: 'var(--accent-cyan)',
                    amber: 'var(--accent-amber)',
                    coral: 'var(--accent-coral)',
                    purple: 'var(--accent-purple)',
                },
                text: {
                    primary: 'var(--text-primary)',
                    secondary: 'var(--text-secondary)',
                    muted: 'var(--text-muted)',
                    'on-brand': 'var(--text-on-brand)',
                },
            },

            /* Kinetic Typography */
            fontFamily: {
                display: ['var(--font-display)'],
                body: ['var(--font-body)'],
                mono: ['var(--font-mono)'],
            },

            fontSize: {
                'hero': ['var(--text-hero)', { lineHeight: '1', letterSpacing: '-0.05em', fontWeight: '800' }],
                'prism-4xl': ['var(--text-4xl)', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '700' }],
                'prism-xs': 'var(--text-xs)',
                'prism-sm': 'var(--text-sm)',
                'prism-base': 'var(--text-base)',
            },

            /* Spatial Depth System */
            borderRadius: {
                'prism': 'var(--radius-prism)',
            },

            boxShadow: {
                'spatial-sm': 'var(--shadow-spatial-sm)',
                'spatial-md': 'var(--shadow-spatial-md)',
                'spatial-lg': 'var(--shadow-spatial-lg)',
                'inner-rim': 'var(--inner-rim)',
            },

            backgroundImage: {
                'aurora-mesh': 'radial-gradient(at 0% 0%, var(--brand-aurora-1) 0, transparent 50%), radial-gradient(at 50% 0%, var(--brand-aurora-2) 0, transparent 50%), radial-gradient(at 100% 0%, var(--brand-aurora-3) 0, transparent 50%)',
            },

            /* Transitions & Physics */
            transitionTimingFunction: {
                'prism-snappy': 'var(--spring-snappy)',
                'prism-bouncy': 'var(--spring-bouncy)',
            },

            animation: {
                'aurora-flow': 'auroraFlow 20s ease infinite alternate',
                'prism-reveal': 'prismReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'fade-in-up': 'fadeInUp 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'shimmer': 'shimmer 1.5s infinite',
                'emergency-pulse': 'emergencyPulse 2s ease-in-out infinite',
            },

            keyframes: {
                auroraFlow: {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                },
                prismReveal: {
                    '0%': { opacity: '0', transform: 'translateY(20px) scale(0.98)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                emergencyPulse: {
                    '0%, 100%': { boxShadow: '0 0 0 0 oklch(0.65 0.18 160 / 0.4)' },
                    '50%': { boxShadow: '0 0 0 8px oklch(0.65 0.18 160 / 0)' },
                },
            },

            spacing: {
                'safe-bottom': 'env(safe-area-inset-bottom)',
                'safe-top': 'env(safe-area-inset-top)',
                'safe-left': 'env(safe-area-inset-left)',
                'safe-right': 'env(safe-area-inset-right)',
            },

            height: {
                'dvh': '100dvh',
            },
            minHeight: {
                'dvh': '100dvh',
                'svh': '100svh',
            },
        },
    },
    plugins: [
        function({ addUtilities, addComponents }) {
            addUtilities({
                '.glass-morphism': {
                    'background': 'var(--surface-glass)',
                    'backdrop-filter': 'blur(24px) saturate(180%)',
                    '-webkit-backdrop-filter': 'blur(24px) saturate(180%)',
                    'border': '1px solid oklch(1 0 0 / 0.1)',
                    'box-shadow': 'var(--shadow-spatial-md)',
                },
                '.text-balance': {
                    'text-wrap': 'balance',
                },
                '.safe-padding-bottom': {
                    'padding-bottom': 'max(1rem, env(safe-area-inset-bottom))',
                },
                '.safe-padding-top': {
                    'padding-top': 'max(1rem, env(safe-area-inset-top))',
                },
                '.touch-scroll': {
                    '-webkit-overflow-scrolling': 'touch',
                    'overscroll-behavior': 'contain',
                },
                '.no-tap-highlight': {
                    '-webkit-tap-highlight-color': 'transparent',
                },
                '.hide-scrollbar': {
                    '-ms-overflow-style': 'none',
                    'scrollbar-width': 'none',
                    '&::-webkit-scrollbar': {
                        'display': 'none',
                    },
                },
            });
            addComponents({
                '.mobile-container': {
                    'width': '100%',
                    'padding-left': '1rem',
                    'padding-right': '1rem',
                    '@media (min-width: 640px)': {
                        'padding-left': '1.5rem',
                        'padding-right': '1.5rem',
                    },
                    '@media (min-width: 1024px)': {
                        'padding-left': '2rem',
                        'padding-right': '2rem',
                    },
                },
                '.mobile-card': {
                    'border-radius': '0.75rem',
                    'padding': '1rem',
                    '@media (min-width: 768px)': {
                        'border-radius': '1rem',
                        'padding': '1.5rem',
                    },
                },
                '.mobile-stack': {
                    'display': 'flex',
                    'flex-direction': 'column',
                    'gap': '0.75rem',
                    '@media (min-width: 768px)': {
                        'gap': '1rem',
                    },
                },
            });
        },
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("tailwindcss-animate"),
    ],
};
