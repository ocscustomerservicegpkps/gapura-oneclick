
import {
    LayoutDashboard,
    FileText,
    Plane,
    ClipboardList,
    Users,
    ChevronRight,
    Hash,
    FolderOpen,
    Shield,
    Brain,
    Calendar,
    Layers,
    Link2,
    Bell,
    BookOpen,
    QrCode,
    type LucideIcon,
} from 'lucide-react';

export interface NavItemConfig {

    href: string;

    label: string;

    icon: LucideIcon;

    count?: number;

    external?: boolean;

    comingSoon?: boolean;
}

export interface NavGroupConfig {

    title: string;

    items: NavItemConfig[];
}

const LINKS_CONFIG: Record<string, NavGroupConfig[]> = {

    'ADMIN': [
        {
            title: 'Overview',
            items: [
                { href: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/dashboard/admin/security', label: 'Security', icon: Shield },
            ]
        },
        {
            title: 'Management',
            items: [
                { href: '/dashboard/admin/reports', label: 'Reports', icon: ClipboardList },
                { href: '/dashboard/admin/users', label: 'Users', icon: Users },
                { href: '/dashboard/admin/external-links', label: 'External Links', icon: Link2 },
            ]
        }
    ],

    'EMPLOYEE': [
        {
            title: 'Workspace',
            items: [
                { href: '/dashboard/employee', label: 'My Reports', icon: FileText },
                { href: '/dashboard/employee/new', label: 'Create Report', icon: Plane },
                { href: '/dashboard/employee/quick-access', label: 'Quick Access', icon: ChevronRight },
                { href: '/dashboard/employee/documents', label: 'Documents', icon: BookOpen },
            ]
        }
    ],

    'STAFF_CABANG': [
        {
            title: 'Workspace',
            items: [
                { href: '/dashboard/employee', label: 'My Reports', icon: FileText },
                { href: '/dashboard/employee/documents', label: 'Document Meeting', icon: BookOpen },
            ]
        }
    ],

    'MANAGER': [
        {
            title: 'Overview',
            items: [
                { href: '/dashboard/manager', label: 'Dashboard', icon: LayoutDashboard },
            ]
        },
        {
            title: 'Workspace',
            items: [
                { href: '/dashboard/employee/reports', label: 'All Reports', icon: ClipboardList },
                { href: '/dashboard/manager/documents', label: 'Document Meeting', icon: BookOpen },
            ]
        },
        {
            title: 'Management',
            items: [
                { href: '/dashboard/admin/users', label: 'Manage Staff', icon: Users },
            ]
        }
    ],

    'OCS': [
        {
            title: 'Monitoring',
            items: [
                { href: '/dashboard/ocs', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/dashboard/ocs/reports', label: 'All Reports', icon: ClipboardList },
            ]
        },
        {
            title: 'Schedule',
            items: [
                { href: '/dashboard/ocs/calendar', label: 'Event Calendar', icon: Calendar },
                { href: '/dashboard/ocs/meetings', label: 'Meeting Calendar', icon: Calendar },
            ]
        }
    ],

    // ponytail: new OS is an independent copy of OCS; only Dashboard + Reports
    // shipped now. Fork the OCS subroutes (calendar/sla/wsn/...) here when OS needs them.
    'OS': [
        {
            title: 'Monitoring',
            items: [
                { href: '/dashboard/os', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/dashboard/os/reports', label: 'All Reports', icon: ClipboardList },
            ]
        }
    ],

    'OP': [
        {
            title: 'Operational Dashboard',
            items: [
                { href: '/dashboard/op', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/dashboard/op/reports', label: 'All Reports', icon: ClipboardList },
            ]
        }
    ],

    'HC': [
        {
            title: 'HC Home',
            items: [
                { href: '/dashboard/hc', label: 'Circulars & Socialization Materials', icon: LayoutDashboard },
            ]
        }
    ],

    'DIVISI_ESKALASI': [
        {
            title: 'Escalation Center',
            items: [
                { href: '/dashboard/eskalasi/select', label: 'Select Division', icon: Layers },
            ]
        }
    ],

    'SUPER_ADMIN': [
        {
            title: 'Command Center',
            items: [
                { href: '/dashboard/analyst', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/dashboard/analyst/import', label: 'Import Data', icon: FolderOpen },
                { href: '/dashboard/employee/new', label: 'Create Report', icon: Plane },
            ]
        },
        {
            title: 'Super Admin',
            items: [
                { href: '/dashboard/admin/users', label: 'User Management', icon: Users },
                { href: '/dashboard/admin/security', label: 'Security', icon: Shield },
                { href: '/dashboard/admin/external-links', label: 'External Links', icon: Link2 },
            ]
        },
        {
            title: 'Schedule',
            items: [
                { href: '/dashboard/analyst/notifications', label: 'Notifications', icon: Bell },
            ]
        }
    ],

    'ANALYST': [
        {
            title: 'Command Center',
            items: [
                { href: '/dashboard/analyst', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/dashboard/analyst/reports', label: 'Reports', icon: ClipboardList },
                { href: '/dashboard/analyst/ai-reports', label: 'AI Reports', icon: Brain },
                { href: '/dashboard/analyst/builder', label: 'Explore & Build', icon: Hash },
                { href: '/dashboard/analyst/dashboards', label: 'Custom Dashboards', icon: FolderOpen },
                { href: '/dashboard/analyst/import', label: 'Import Data', icon: FolderOpen },
                { href: '/dashboard/analyst/documents', label: 'Documents', icon: BookOpen },
                { href: '/dashboard/analyst/performance-links', label: 'Performance Links', icon: QrCode },
            ]
        },
        {
            title: 'Schedule',
            items: [
                { href: '/dashboard/analyst/calendar', label: 'Event Calendar', icon: Calendar },
                { href: '/dashboard/analyst/meetings', label: 'Meeting Calendar', icon: Calendar },
                { href: '/dashboard/analyst/notifications', label: 'Notifications', icon: Bell },
            ]
        }
    ]
};

// Only OCS-division analysts keep these features; every other analyst loses
// performance evaluation, circulars/documents, import, calendars, notifications.
const OCS_ONLY_ANALYST_PATHS = /\/(ocs|calendar|meetings|notifications|performance-links|import|builder|dashboards|documents)(\?|$|\/)/;

export const resolveNavGroups = (role: string, division?: string | null): NavGroupConfig[] => {
    const groups = LINKS_CONFIG[GET_LINKS_KEY(role)] || [];
    const r = (role || '').toUpperCase();
    const div = (division || '').toUpperCase();

    if (r === 'ANALYST' && div !== 'OCS') {
        return groups
            .map((group) => ({
                ...group,
                items: group.items.filter((item) => !OCS_ONLY_ANALYST_PATHS.test(item.href)),
            }))
            .filter((group) => group.items.length > 0);
    }

    return groups;
};

const GET_LINKS_KEY = (role: string): string => {
    const r = (role || '').toUpperCase();

    if (r.includes('SUPER') || r === 'ADMIN') return 'SUPER_ADMIN';
    if (r === 'ANALYST') return 'ANALYST';
    if (r === 'MANAGER_CABANG') return 'MANAGER';
    if (r === 'STAFF_CABANG') return 'STAFF_CABANG';

    if (r === 'DIVISI_ESKALASI') {
        return 'DIVISI_ESKALASI';
    }

    if (r === 'DIVISI_OCS' || r === 'PARTNER_OCS') return 'OCS';
    if (r === 'DIVISI_OS' || r === 'PARTNER_OS') return 'OS';
    if (r === 'DIVISI_HC' || r === 'PARTNER_HC') return 'HC';
    // OP / OT / UQ / HT all share the operational monitoring dashboard ("same UI as OP").
    if (
        r === 'DIVISI_OP' || r === 'PARTNER_OP' ||
        r === 'DIVISI_OT' || r === 'PARTNER_OT' ||
        r === 'DIVISI_UQ' || r === 'PARTNER_UQ' ||
        r === 'DIVISI_HT' || r === 'PARTNER_HT'
    ) return 'OP';

    return 'EMPLOYEE';
};
