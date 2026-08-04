
import Image from 'next/image';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
    return (
        <div className="min-h-[100dvh] flex flex-col lg:flex-row relative overflow-hidden bg-slate-50">
            <div
                className="hidden lg:flex lg:w-1/2 lg:h-[100dvh] flex-col p-6 xl:p-8 relative overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #059669, #10b981, #34d399)' }}
            >
                <div className="absolute inset-0 opacity-10">
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: 'radial-gradient(circle at 25% 25%, white 2px, transparent 2px)',
                            backgroundSize: '50px 50px',
                        }}
                    />
                </div>

                <div className="relative z-10 shrink-0">
                    <Image
                        src="/logo.png"
                        alt="Gapura"
                        width={180}
                        height={68}
                        className="object-contain brightness-0 invert h-auto w-[140px] xl:w-[180px]"
                        style={{ height: 'auto' }}
                    />
                </div>

                <div className="relative z-10 flex-1 min-h-0 flex flex-col gap-2 mt-4">
                    <div className="relative flex-[3] min-h-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/20">
                        <Image
                            src="/login-collage-1.webp"
                            alt="Petugas JOUMPA melayani penumpang di terminal"
                            fill
                            sizes="(max-width: 1023px) 0px, 50vw"
                            className="object-cover"
                            quality={70}
                            fetchPriority="high"
                            loading="eager"
                        />
                    </div>

                    <div className="flex gap-2 flex-[2] min-h-0">
                        <div className="relative flex-[1536] basis-0 overflow-hidden rounded-2xl shadow-xl ring-1 ring-white/20">
                            <Image
                                src="/login-collage-2.webp"
                                alt="Aktivitas ground handling pesawat"
                                fill
                                sizes="(max-width: 1023px) 0px, 25vw"
                                className="object-cover"
                            />
                        </div>

                        <div className="relative flex-[1333] basis-0 overflow-hidden rounded-2xl shadow-xl ring-1 ring-white/20">
                            <Image
                                src="/login-collage-3.webp"
                                alt="Kendaraan ground support Gapura di apron"
                                fill
                                sizes="(max-width: 1023px) 0px, 25vw"
                                className="object-cover"
                            />
                        </div>
                    </div>
                </div>

                <div className="relative z-10 shrink-0 mt-4 space-y-2">
                    <h1 className="text-xl xl:text-2xl font-bold text-white leading-tight">
                        <em>&quot;One Click&quot;</em> Irregularity Report
                    </h1>
                    <p className="text-white/80 text-sm xl:text-[15px] max-w-md leading-snug">
                        Integrated system for reporting, tracking, and resolving aviation operational irregularities.
                    </p>
                    <p className="text-white/60 text-[11px] xl:text-xs pt-1">
                        © 2025 Gapura Angkasa. All rights reserved.
                    </p>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center px-4 py-5 sm:p-6 md:p-8">
                <div className="w-full max-w-md">
                    <div className="mb-5 rounded-[28px] border border-emerald-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.96))] px-4 sm:px-5 py-6 shadow-[0_10px_30px_rgba(16,185,129,0.08)] lg:hidden">
                        <Image
                            src="/logo.png"
                            alt="Gapura"
                            width={200}
                            height={75}
                            className="object-contain w-[132px] h-auto"
                            style={{ height: 'auto' }}
                        />
                        <div className="mt-5">
                            <h1 className="text-[1.9rem] font-bold tracking-[-0.04em] text-slate-900">Welcome Back</h1>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Sign in to OneClick for irregularity reporting and follow-up actions.
                            </p>
                        </div>
                    </div>

                    <div className="mb-6 hidden lg:block sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome Back</h1>
                        <p className="text-gray-500 mt-1.5 sm:mt-2 text-sm sm:text-base">Sign in to your OneClick platform</p>
                    </div>

                    <LoginForm />
                </div>
            </div>
        </div>
    );
}
