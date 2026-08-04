
interface DivisionConfig {

    code: string;

    name: string;

    color: string;

    gradient: string;

    bgLight: string;

    textColor: string;

    borderColor?: string;
}

export const DIVISIONS: Record<string, DivisionConfig> = {
    OP: {
        code: 'OP',
        name: 'Operasi',
        color: '#06b6d4',
        gradient: 'from-cyan-500 via-cyan-600 to-teal-600',
        bgLight: 'bg-cyan-50',
        textColor: 'text-cyan-600',
    },
    OCS: {
        code: 'OCS',
        name: 'Customer Service',
        color: '#10b981',
        gradient: 'from-emerald-500 via-emerald-600 to-teal-600',
        bgLight: 'bg-emerald-50',
        textColor: 'text-emerald-600',
    },
    OS: {
        code: 'OS',
        name: 'Customer Service',
        color: '#10b981',
        gradient: 'from-emerald-500 via-emerald-600 to-teal-600',
        bgLight: 'bg-emerald-50',
        textColor: 'text-emerald-600',
    },
    OT: {
        code: 'OT',
        name: 'Operasi',
        color: '#f59e0b',
        gradient: 'from-amber-500 via-orange-600 to-amber-600',
        bgLight: 'bg-amber-50',
        textColor: 'text-amber-600',
    },
    UQ: {
        code: 'UQ',
        name: 'Operasi',
        color: '#6366f1',
        gradient: 'from-indigo-500 via-indigo-600 to-blue-600',
        bgLight: 'bg-indigo-50',
        textColor: 'text-indigo-600',
    },
    HC: {
        code: 'HC',
        name: 'Human Capital',
        color: '#8b5cf6',
        gradient: 'from-violet-500 via-fuchsia-600 to-rose-500',
        bgLight: 'bg-violet-50',
        textColor: 'text-violet-600',
        borderColor: 'border-violet-200',
    },
    HT: {
        code: 'HT',
        name: 'Human Training',
        color: '#0ea5e9',
        gradient: 'from-sky-500 via-blue-600 to-indigo-600',
        bgLight: 'bg-sky-50',
        textColor: 'text-sky-600',
        borderColor: 'border-sky-200',
    },
    ANALYST: {
        code: 'ANALYST',
        name: 'Analyst',
        color: '#10b981',
        gradient: 'from-emerald-500 via-emerald-600 to-teal-600',
        bgLight: 'bg-emerald-50',
        textColor: 'text-emerald-600',
    },
};
