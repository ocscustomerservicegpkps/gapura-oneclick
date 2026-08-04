
import Link from 'next/link';

function LogoInline() {
  return (
    <svg
      width={56}
      height={56}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="512" height="512" rx="96" fill="#0f766e" />
      <path
        d="M256 108C173.2 108 106.4 174.8 106.4 257.6c0 82.8 66.8 149.6 149.6 149.6 82.8 0 149.6-66.8 149.6-149.6C405.6 174.8 338.8 108 256 108zm0 272c-67.6 0-122.4-54.8-122.4-122.4S188.4 135.2 256 135.2s122.4 54.8 122.4 122.4S323.6 380 256 380z"
        fill="rgba(255,255,255,0.15)"
      />
      <path
        d="M220 256l24 24 48-48"
        stroke="white"
        strokeWidth={24}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-8 bg-emerald-50">
      <div className="max-w-md w-full bg-white rounded-2xl border border-emerald-100 shadow-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <LogoInline />
        </div>
        <h1 className="text-xl font-bold text-emerald-800">Anda sedang offline</h1>
        <p className="text-emerald-700/80 mt-2">
          Koneksi internet tidak tersedia. Beberapa halaman masih bisa dibuka, silakan coba lagi nanti.
        </p>
        <Link
          href="/"
          className="inline-flex mt-6 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
