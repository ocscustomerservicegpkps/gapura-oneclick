'use client';

import type { CSSProperties } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { QUICK_ACCESS_ICON_MAP } from '@/lib/quick-access';

interface QAIconProps {
    name: string;
    className?: string;
    style?: CSSProperties;
}

/**
 * Module-level icon renderer — does the whitelist lookup inside its own
 * render (the map is stable), so no component is created during parent render.
 */
export function QAIcon({ name, className, style }: QAIconProps) {
    const Icon = QUICK_ACCESS_ICON_MAP[name] || LinkIcon;
    return <Icon className={className} style={style} />;
}
