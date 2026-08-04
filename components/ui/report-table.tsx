import * as React from 'react';
import { cn } from '@/lib/utils';

type ReportTableProps = React.TableHTMLAttributes<HTMLTableElement> & {
    containerClassName?: string;
    density?: 'compact' | 'comfortable';
};

const ReportTable = React.forwardRef<HTMLTableElement, ReportTableProps>(
    ({ className, containerClassName, density = 'comfortable', ...props }, ref) => (
        <div
            className={cn(
                'w-full overflow-auto rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_oklch(0.20_0.01_250_/_0.04),0_10px_24px_-10px_oklch(0.20_0.01_250_/_0.08)]',
                containerClassName
            )}
        >
            <table
                ref={ref}
                className={cn(
                    'w-full border-separate border-spacing-0 text-left',
                    density === 'compact' ? 'text-[14px]' : 'text-[15px]',
                    className
                )}
                {...props}
            />
        </div>
    )
);
ReportTable.displayName = 'ReportTable';

const ReportTHead = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <thead ref={ref} className={cn('bg-slate-50 text-slate-700', className)} {...props} />
    )
);
ReportTHead.displayName = 'ReportTHead';

const ReportTBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
    )
);
ReportTBody.displayName = 'ReportTBody';

const ReportTFoot = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <tfoot ref={ref} className={cn('border-t bg-slate-50 font-semibold', className)} {...props} />
    )
);
ReportTFoot.displayName = 'ReportTFoot';

const ReportTR = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
    ({ className, ...props }, ref) => (
        <tr ref={ref} className={cn('border-b border-slate-200 transition-colors', className)} {...props} />
    )
);
ReportTR.displayName = 'ReportTR';

const ReportTH = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
    ({ className, ...props }, ref) => (
        <th ref={ref} className={cn('px-3 py-2 font-semibold', className)} {...props} />
    )
);
ReportTH.displayName = 'ReportTH';

const ReportTD = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
    ({ className, ...props }, ref) => (
        <td ref={ref} className={cn('px-3 py-2 align-middle', className)} {...props} />
    )
);
ReportTD.displayName = 'ReportTD';

export {
    ReportTable,
    ReportTHead,
    ReportTBody,
    ReportTFoot,
    ReportTR,
    ReportTH,
    ReportTD,
};
