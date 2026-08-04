'use client';

import { ReactNode } from 'react';

interface WizardStepProps {
    children: ReactNode;
    isActive: boolean;
    direction?: 'forward' | 'backward';
}

export function WizardStep({ children, isActive }: WizardStepProps) {
    if (!isActive) return null;

    return (
        <div className="animate-fade-in-up">
            {children}
        </div>
    );
}
