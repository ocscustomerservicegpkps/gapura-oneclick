import { Suspense } from 'react';
import NotificationSettings from '@/components/dashboard/NotificationSettings';

export const metadata = {
    title: 'Konfigurasi Notifikasi | OneClick',
    description: 'Kelola daftar penerima notifikasi email irregularity baru di OneClick.',
};

export default function AnalystNotificationsPage() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-[var(--surface-0)]">
            <Suspense fallback={
                <div className="flex items-center justify-center p-12">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
            }>
                <NotificationSettings />
            </Suspense>
        </div>
    );
}
