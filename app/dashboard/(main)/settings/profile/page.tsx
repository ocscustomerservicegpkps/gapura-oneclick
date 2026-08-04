import type { Metadata } from 'next';
import ProfileSettings from '@/components/settings/ProfileSettings';

export const metadata: Metadata = {
    title: 'Profile Settings',
};

export const dynamic = 'force-dynamic';

export default function ProfileSettingsPage() {
    return (
        <div className="mx-auto w-full max-w-4xl px-1 py-2 sm:px-0">
            <header className="mb-5">
                <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Profile Settings</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Manage your personal details and OneKlik account security.
                </p>
            </header>

            <ProfileSettings />
        </div>
    );
}
